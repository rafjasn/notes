import { registerAs } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';
const localstackEndpoint = 'http://localstack:4566';
const localstackQueueUrl = 'http://localstack:4566/000000000000/notes-events-queue';
const localstackTopicArn = 'arn:aws:sns:us-east-1:000000000000:notes-events';

export default registerAs('app', () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    mongoUri: process.env.MONGO_URI || 'mongodb://mongo:27017/notes',
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-development',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    name: process.env.APP_NAME || 'NotesApp',
    auth: {
        provider: process.env.AUTH_PROVIDER || 'keycloak',
        keycloak: {
            url: process.env.KEYCLOAK_URL || 'http://keycloak:8080',
            realm: process.env.KEYCLOAK_REALM || 'notes',
            clientId: process.env.KEYCLOAK_CLIENT_ID || 'notes-api',
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
            adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'notes-admin',
            adminClientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || 'CHANGE_ME_IN_ENV'
        },
        cognito: {
            clientId: process.env.COGNITO_CLIENT_ID,
            userPoolId: process.env.COGNITO_USER_POOL_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            hostedUiDomain: process.env.COGNITO_HOSTED_UI_DOMAIN
        }
    },
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost',
    mail: {
        transport:
            process.env.MAIL_TRANSPORT || (isProduction && !process.env.SMTP_HOST ? 'ses' : 'log'),
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '1025', 10),
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        from: process.env.MAIL_FROM || 'no-reply@notes.local'
    },
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint: process.env.AWS_ENDPOINT || (!isProduction ? localstackEndpoint : undefined),
        snsTopicArn: process.env.SNS_TOPIC_ARN || (!isProduction ? localstackTopicArn : undefined),
        sqsQueueUrl: process.env.SQS_QUEUE_URL || (!isProduction ? localstackQueueUrl : undefined)
    }
}));
