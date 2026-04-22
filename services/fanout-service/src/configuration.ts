import { registerAs } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';
const localstackEndpoint = 'http://localstack:4566';
const localstackQueueUrl = 'http://localstack:4566/000000000000/notes-events-queue';

function staticCredentials() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };
    }

    if (!isProduction && (process.env.AWS_ENDPOINT || process.env.SQS_ENDPOINT)) {
        return {
            accessKeyId: 'test',
            secretAccessKey: 'test'
        };
    }

    return undefined;
}

export default registerAs('fanout', () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    apiBaseUrl: process.env.API_BASE_URL || 'http://api:3000/api',
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'change-me-in-development'
    },
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint:
            process.env.SQS_ENDPOINT ||
            process.env.AWS_ENDPOINT ||
            (!isProduction ? localstackEndpoint : undefined),
        queueUrl: process.env.SQS_QUEUE_URL || (!isProduction ? localstackQueueUrl : undefined),
        credentials: staticCredentials()
    }
}));
