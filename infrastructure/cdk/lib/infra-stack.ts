import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface NotesInfraStackProps extends cdk.StackProps {
    removalPolicy?: cdk.RemovalPolicy;
    auth: {
        callbackUrls: string[];
        logoutUrls: string[];
        domainPrefix: string;
    };
}

export class NotesInfraStack extends cdk.Stack {
    readonly vpc: ec2.Vpc;
    readonly repositories: Record<'api' | 'fanout' | 'frontend', ecr.Repository>;
    readonly notesKmsKey: kms.Key;
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly userPoolDomain: cognito.UserPoolDomain;
    readonly eventsTopic: sns.Topic;
    readonly eventsQueue: sqs.Queue;
    readonly realtimeCacheSecurityGroup: ec2.SecurityGroup;
    readonly realtimeRedisEndpoint: string;
    readonly realtimeRedisPort: string;
    readonly logGroups: Record<'api' | 'fanout' | 'frontend', logs.LogGroup>;

    constructor(scope: Construct, id: string, props: NotesInfraStackProps) {
        super(scope, id, props);

        const removal = props.removalPolicy ?? cdk.RemovalPolicy.RETAIN;

        // VPC
        this.vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
                { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 }
            ]
        });

        this.realtimeCacheSecurityGroup = new ec2.SecurityGroup(this, 'RealtimeRedisSg', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Controls access to the Notes realtime Redis adapter cache'
        });
        this.realtimeCacheSecurityGroup.applyRemovalPolicy(removal);

        const realtimeRedisSubnetGroup = new elasticache.CfnSubnetGroup(
            this,
            'RealtimeRedisSubnetGroup',
            {
                description: 'Private subnets for the Notes realtime Redis adapter cache',
                subnetIds: this.vpc.selectSubnets({
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
                }).subnetIds
            }
        );
        realtimeRedisSubnetGroup.applyRemovalPolicy(removal);

        const realtimeRedis = new elasticache.CfnReplicationGroup(this, 'RealtimeRedis', {
            replicationGroupDescription: 'Redis pub/sub for Socket.IO realtime fanout',
            engine: 'redis',
            engineVersion: '7.1',
            cacheNodeType: 'cache.t4g.micro',
            numCacheClusters: 2,
            automaticFailoverEnabled: true,
            multiAzEnabled: true,
            atRestEncryptionEnabled: true,
            transitEncryptionEnabled: true,
            port: 6379,
            cacheSubnetGroupName: realtimeRedisSubnetGroup.ref,
            securityGroupIds: [this.realtimeCacheSecurityGroup.securityGroupId]
        });
        realtimeRedis.applyRemovalPolicy(removal);

        this.realtimeRedisEndpoint = realtimeRedis.attrPrimaryEndPointAddress;
        this.realtimeRedisPort = realtimeRedis.attrPrimaryEndPointPort;

        // ECR Repositories
        const serviceNames = ['api', 'fanout', 'frontend'] as const;
        this.repositories = {} as typeof this.repositories;

        for (const service of serviceNames) {
            this.repositories[service] = new ecr.Repository(this, `${service}Repo`, {
                repositoryName: `notes-${service}`,
                removalPolicy: removal,
                emptyOnDelete: removal === cdk.RemovalPolicy.DESTROY,
                lifecycleRules: [{ maxImageCount: 10 }]
            });
        }

        // KMS key for note envelope encryption
        this.notesKmsKey = new kms.Key(this, 'NotesKmsKey', {
            description: 'Encrypts per-workspace note data keys',
            enableKeyRotation: true,
            alias: 'alias/notes',
            removalPolicy: removal
        });

        // Cognito
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            removalPolicy: removal
        });

        this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool: this.userPool,
            authFlows: { userPassword: true, userSrp: true },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true
                },
                scopes: [
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE
                ],
                callbackUrls: props.auth.callbackUrls,
                logoutUrls: props.auth.logoutUrls
            },
            supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
            generateSecret: false
        });

        this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
            cognitoDomain: {
                domainPrefix: props.auth.domainPrefix
            }
        });

        // SNS / SQS
        this.eventsTopic = new sns.Topic(this, 'EventsTopic', {
            topicName: 'notes-events'
        });

        const eventsDlq = new sqs.Queue(this, 'EventsDlq', {
            queueName: 'notes-events-dlq',
            retentionPeriod: cdk.Duration.days(14)
        });

        this.eventsQueue = new sqs.Queue(this, 'EventsQueue', {
            queueName: 'notes-events-queue',
            deadLetterQueue: { queue: eventsDlq, maxReceiveCount: 5 }
        });
        this.eventsTopic.addSubscription(new subscriptions.SqsSubscription(this.eventsQueue));

        // CloudWatch Log Groups
        this.logGroups = {
            api: new logs.LogGroup(this, 'ApiLogGroup', {
                logGroupName: '/notes/api',
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY
            }),
            fanout: new logs.LogGroup(this, 'FanoutLogGroup', {
                logGroupName: '/notes/fanout',
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY
            }),
            frontend: new logs.LogGroup(this, 'FrontendLogGroup', {
                logGroupName: '/notes/frontend',
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY
            })
        };

        // Alarms
        const alertsTopic = new sns.Topic(this, 'AlertsTopic', {
            topicName: 'notes-alerts'
        });

        const apiErrorMetric = new logs.MetricFilter(this, 'ApiErrorMetric', {
            logGroup: this.logGroups.api,
            metricNamespace: 'Notes/Api',
            metricName: 'ErrorCount',
            filterPattern: logs.FilterPattern.anyTerm('ERROR', 'FATAL'),
            metricValue: '1',
            defaultValue: 0
        });

        new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
            alarmName: 'notes-api-errors',
            alarmDescription: 'API error rate exceeded 5 in 5 minutes',
            metric: apiErrorMetric.metric({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            threshold: 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        }).addAlarmAction(new actions.SnsAction(alertsTopic));

        new cloudwatch.Alarm(this, 'EventsDlqAlarm', {
            alarmName: 'notes-events-dlq-depth',
            alarmDescription: 'Messages in notes-events DLQ — events are failing to process',
            metric: eventsDlq.metricApproximateNumberOfMessagesVisible({
                period: cdk.Duration.minutes(5),
                statistic: 'Maximum'
            }),
            threshold: 0,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        }).addAlarmAction(new actions.SnsAction(alertsTopic));

        // Outputs
        new cdk.CfnOutput(this, 'NotesKmsKeyArn', { value: this.notesKmsKey.keyArn });
        new cdk.CfnOutput(this, 'CognitoUserPoolId', { value: this.userPool.userPoolId });
        new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
            value: this.userPoolClient.userPoolClientId
        });
        new cdk.CfnOutput(this, 'CognitoHostedUiDomain', {
            value: `https://${this.userPoolDomain.domainName}`
        });
        new cdk.CfnOutput(this, 'RealtimeRedisEndpoint', {
            value: this.realtimeRedisEndpoint
        });

        for (const [svc, repo] of Object.entries(this.repositories)) {
            new cdk.CfnOutput(this, `${svc}RepoUri`, { value: repo.repositoryUri });
        }
    }
}
