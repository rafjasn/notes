import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NotesInfraStack } from './infra-stack';

export interface NotesServicesStackProps extends cdk.StackProps {
    infra: NotesInfraStack;
    imageTag: string;
    corsOrigin: string;
    mailFrom: string;
}

export class NotesServicesStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: NotesServicesStackProps) {
        super(scope, id, props);

        const { infra, imageTag, corsOrigin, mailFrom } = props;

        const mongoUriSecret = secretsmanager.Secret.fromSecretNameV2(
            this,
            'MongoUriSecret',
            'notes/mongo-uri'
        );
        const jwtSecret = secretsmanager.Secret.fromSecretNameV2(
            this,
            'JwtSecret',
            'notes/jwt-secret'
        );

        // ECS Cluster
        const cluster = new ecs.Cluster(this, 'Cluster', {
            vpc: infra.vpc,
            clusterName: 'notes',
            containerInsightsV2: ecs.ContainerInsights.ENABLED
        });

        // API Fargate Service (creates the ALB and listener)
        const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(
            this,
            'ApiService',
            {
                cluster,
                desiredCount: 2,
                minHealthyPercent: 100,
                maxHealthyPercent: 200,
                publicLoadBalancer: true,
                taskImageOptions: {
                    image: ecs.ContainerImage.fromEcrRepository(infra.repositories.api, imageTag),
                    containerPort: 3000,
                    logDriver: ecs.LogDrivers.awsLogs({
                        streamPrefix: 'api',
                        logGroup: infra.logGroups.api
                    }),
                    environment: {
                        NODE_ENV: 'production',
                        PORT: '3000',
                        CORS_ORIGIN: corsOrigin,
                        FRONTEND_URL: corsOrigin,
                        AUTH_PROVIDER: 'cognito',
                        COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
                        COGNITO_CLIENT_ID: infra.userPoolClient.userPoolClientId,
                        COGNITO_HOSTED_UI_DOMAIN: `https://${infra.userPoolDomain.domainName}`,
                        AWS_REGION: this.region,
                        SNS_TOPIC_ARN: infra.eventsTopic.topicArn,
                        SQS_QUEUE_URL: infra.eventsQueue.queueUrl,
                        MAIL_TRANSPORT: 'ses',
                        MAIL_FROM: mailFrom
                    },
                    secrets: {
                        MONGO_URI: ecs.Secret.fromSecretsManager(mongoUriSecret),
                        JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret)
                    }
                }
            }
        );

        apiService.targetGroup.configureHealthCheck({
            path: '/api/health',
            healthyHttpCodes: '200'
        });

        infra.eventsTopic.grantPublish(apiService.taskDefinition.taskRole);
        infra.eventsQueue.grantConsumeMessages(apiService.taskDefinition.taskRole);
        apiService.taskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                actions: ['ses:SendEmail', 'ses:SendRawEmail'],
                resources: ['*']
            })
        );
        apiService.taskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                actions: ['sns:Publish'],
                resources: ['*']
            })
        );

        const albDns = apiService.loadBalancer.loadBalancerDnsName;

        // Fanout Fargate Service
        const fanoutTask = new ecs.FargateTaskDefinition(this, 'FanoutTaskDef', {
            cpu: 256,
            memoryLimitMiB: 512
        });
        const fanoutSecurityGroup = new ec2.SecurityGroup(this, 'FanoutSecurityGroup', {
            vpc: infra.vpc,
            allowAllOutbound: true,
            description: 'Controls network access for Notes fanout tasks'
        });

        fanoutTask.addContainer('FanoutContainer', {
            image: ecs.ContainerImage.fromEcrRepository(infra.repositories.fanout, imageTag),
            environment: {
                NODE_ENV: 'production',
                PORT: '3000',
                CORS_ORIGIN: corsOrigin,
                API_BASE_URL: `http://${albDns}/api`,
                AWS_REGION: this.region,
                SQS_QUEUE_URL: infra.eventsQueue.queueUrl,
                REDIS_URL: `rediss://${infra.realtimeRedisEndpoint}:${infra.realtimeRedisPort}`
            },
            secrets: {
                JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret)
            },
            portMappings: [{ containerPort: 3000 }],
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'fanout',
                logGroup: infra.logGroups.fanout
            }),
            healthCheck: {
                command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(5),
                retries: 3
            }
        });

        jwtSecret.grantRead(fanoutTask.executionRole!);
        infra.eventsQueue.grantConsumeMessages(fanoutTask.taskRole);

        const fanoutService = new ecs.FargateService(this, 'FanoutService', {
            cluster,
            taskDefinition: fanoutTask,
            desiredCount: 2,
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            securityGroups: [fanoutSecurityGroup],
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
        });

        new ec2.CfnSecurityGroupIngress(this, 'FanoutToRealtimeRedisIngress', {
            groupId: infra.realtimeCacheSecurityGroup.securityGroupId,
            sourceSecurityGroupId: fanoutSecurityGroup.securityGroupId,
            ipProtocol: 'tcp',
            fromPort: 6379,
            toPort: 6379,
            description: 'Allow fanout tasks to use Redis pub/sub'
        });

        const fanoutTg = new elbv2.ApplicationTargetGroup(this, 'FanoutTg', {
            vpc: infra.vpc,
            port: 3000,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targets: [fanoutService],
            healthCheck: { path: '/health', healthyHttpCodes: '200' },
            stickinessCookieDuration: cdk.Duration.days(1),
            deregistrationDelay: cdk.Duration.seconds(30)
        });

        // Frontend Fargate Service
        const frontendTask = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
            cpu: 512,
            memoryLimitMiB: 1024
        });

        frontendTask.addContainer('FrontendContainer', {
            image: ecs.ContainerImage.fromEcrRepository(infra.repositories.frontend, imageTag),
            portMappings: [{ containerPort: 3000 }],
            environment: {
                NODE_ENV: 'production',
                API_BASE_URL: `http://${albDns}/api`,
                FRONTEND_URL: corsOrigin,
                NEXT_PUBLIC_FRONTEND_URL: corsOrigin,
                NEXT_PUBLIC_WS_URL: corsOrigin,
                AWS_REGION: this.region,
                NEXT_PUBLIC_AWS_REGION: this.region,
                NEXT_PUBLIC_KMS_KEY_ID: infra.notesKmsKey.keyArn,
                AUTH_COOKIE_SECURE: 'true'
            },
            secrets: {
                JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret)
            },
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'frontend',
                logGroup: infra.logGroups.frontend
            }),
            healthCheck: {
                command: ['CMD-SHELL', 'wget -qO- http://localhost:3000/api/bff/health || exit 1'],
                interval: cdk.Duration.seconds(15),
                timeout: cdk.Duration.seconds(5),
                retries: 3,
                startPeriod: cdk.Duration.seconds(60)
            }
        });

        jwtSecret.grantRead(frontendTask.executionRole!);
        infra.notesKmsKey.grantEncryptDecrypt(frontendTask.taskRole);

        const frontendService = new ecs.FargateService(this, 'FrontendService', {
            cluster,
            taskDefinition: frontendTask,
            desiredCount: 1,
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
        });

        const frontendTg = new elbv2.ApplicationTargetGroup(this, 'FrontendTg', {
            vpc: infra.vpc,
            port: 3000,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targets: [frontendService],
            healthCheck: {
                path: '/api/bff/health',
                healthyHttpCodes: '200',
                interval: cdk.Duration.seconds(15),
                healthyThresholdCount: 2
            },
            deregistrationDelay: cdk.Duration.seconds(30)
        });

        // ALB routing
        apiService.listener.addTargetGroups('BffRoute', {
            priority: 8,
            conditions: [elbv2.ListenerCondition.pathPatterns(['/api/bff/*'])],
            targetGroups: [frontendTg]
        });

        apiService.listener.addTargetGroups('KmsRoute', {
            priority: 9,
            conditions: [elbv2.ListenerCondition.pathPatterns(['/api/kms/*'])],
            targetGroups: [frontendTg]
        });

        apiService.listener.addTargetGroups('SocketRoute', {
            priority: 10,
            conditions: [elbv2.ListenerCondition.pathPatterns(['/socket.io/*'])],
            targetGroups: [fanoutTg]
        });

        apiService.listener.addTargetGroups('ApiRoute', {
            priority: 20,
            conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*'])],
            targetGroups: [apiService.targetGroup]
        });

        apiService.listener.addTargetGroups('FrontendRoute', {
            priority: 100,
            conditions: [elbv2.ListenerCondition.pathPatterns(['/*'])],
            targetGroups: [frontendTg]
        });

        new cdk.CfnOutput(this, 'LoadBalancerUrl', {
            value: `http://${albDns}`
        });
    }
}
