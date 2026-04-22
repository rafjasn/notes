#!/bin/sh
set -e

TOPIC_ARN=$(awslocal sns create-topic --name notes-events --query TopicArn --output text)

QUEUE_URL=$(awslocal sqs create-queue --queue-name notes-events-queue --query QueueUrl --output text)
awslocal sqs create-queue --queue-name notes-events-dlq >/dev/null
QUEUE_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names QueueArn \
  --query Attributes.QueueArn \
  --output text)

SUBSCRIPTION_ARN=$(awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_ARN" \
  --query SubscriptionArn \
  --output text)

awslocal sns set-subscription-attributes \
  --subscription-arn "$SUBSCRIPTION_ARN" \
  --attribute-name RawMessageDelivery \
  --attribute-value false >/dev/null

awslocal dynamodb create-table \
  --table-name notes-connections \
  --attribute-definitions AttributeName=connectionId,AttributeType=S AttributeName=workspaceId,AttributeType=S \
  --key-schema AttributeName=connectionId,KeyType=HASH \
  --global-secondary-indexes "IndexName=workspaceId-index,KeySchema=[{AttributeName=workspaceId,KeyType=HASH}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST >/dev/null || true

KEY_ID=$(awslocal kms create-key \
  --description "Local notes envelope encryption key" \
  --query KeyMetadata.KeyId \
  --output text 2>/dev/null || true)

if [ -n "$KEY_ID" ]; then
  awslocal kms create-alias \
    --alias-name alias/notes-local \
    --target-key-id "$KEY_ID" >/dev/null 2>&1 || true
fi

echo "LocalStack notes resources are ready"
