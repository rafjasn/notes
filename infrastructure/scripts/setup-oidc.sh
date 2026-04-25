#!/bin/bash
set -euo pipefail

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
GITHUB_ORG=${GITHUB_ORG:-rafjasn}
REPO_NAME=${REPO_NAME:-notes}
ROLE_NAME=${ROLE_NAME:-notes-github-deploy}
GITHUB_REF_PATTERN=${GITHUB_REF_PATTERN:-repo:${GITHUB_ORG}/${REPO_NAME}:ref:refs/heads/main}

echo "Setting up OIDC for ${GITHUB_ORG}/${REPO_NAME} in account ${AWS_ACCOUNT_ID}..."
echo "GitHub subject condition: ${GITHUB_REF_PATTERN}"

aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  2>/dev/null || echo "OIDC provider already exists, skipping."

cat > /tmp/notes-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "${GITHUB_REF_PATTERN}"
      }
    }
  }]
}
EOF

cat > /tmp/notes-deploy-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationNotesStacks",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateChangeSet",
        "cloudformation:CreateStack",
        "cloudformation:DeleteChangeSet",
        "cloudformation:DeleteStack",
        "cloudformation:Describe*",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:GetTemplate",
        "cloudformation:List*",
        "cloudformation:UpdateStack"
      ],
      "Resource": [
        "arn:aws:cloudformation:${AWS_REGION}:${AWS_ACCOUNT_ID}:stack/Notes*/*",
        "arn:aws:cloudformation:${AWS_REGION}:${AWS_ACCOUNT_ID}:stack/CDKToolkit/*"
      ]
    },
    {
      "Sid": "ManageNotesResources",
      "Effect": "Allow",
      "Action": [
        "application-autoscaling:*",
        "cloudwatch:*",
        "cognito-idp:*",
        "ec2:*",
        "ecr:*",
        "ecs:*",
        "elasticloadbalancing:*",
        "kms:*",
        "logs:*",
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "ses:GetEmailIdentity",
        "ses:ListEmailIdentities",
        "ses:SendEmail",
        "ses:SendRawEmail",
        "sns:*",
        "sqs:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ManageCdkAndNotesRoles",
      "Effect": "Allow",
      "Action": [
        "iam:AttachRolePolicy",
        "iam:CreatePolicy",
        "iam:CreateRole",
        "iam:DeletePolicy",
        "iam:DeleteRole",
        "iam:DeleteRolePolicy",
        "iam:DetachRolePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:List*",
        "iam:PassRole",
        "iam:PutRolePolicy",
        "iam:TagRole",
        "iam:UpdateAssumeRolePolicy",
        "iam:UpdateRole"
      ],
      "Resource": [
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/Notes*",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/notes*",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:role/cdk-*",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/Notes*",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/notes*",
        "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/cdk-*"
      ]
    }
  ]
}
EOF

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file:///tmp/notes-trust-policy.json \
  2>/dev/null || echo "Role ${ROLE_NAME} already exists, updating trust policy."

aws iam update-assume-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-document file:///tmp/notes-trust-policy.json

aws iam detach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess \
  2>/dev/null || true

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name notes-cdk-deploy \
  --policy-document file:///tmp/notes-deploy-policy.json

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo ""
echo "Done. Add these to GitHub Settings:"
echo "  AWS_DEPLOY_ROLE_ARN = ${ROLE_ARN}"
echo "  AWS_ACCOUNT_ID      = ${AWS_ACCOUNT_ID}"
echo "  AWS_REGION          = ${AWS_REGION}"
echo ""
echo "Then run CDK bootstrap:"
echo "  npx cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}"
echo ""
echo "To deploy from a different protected ref, rerun with GITHUB_REF_PATTERN set explicitly."
