# Deployment Guide - Story Text Processing Service

This guide walks you through deploying the Story Text Processing Service to AWS using Terraform.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Terraform >= 1.0** installed
3. **Node.js >= 18.0.0** installed
4. **Access to shared infrastructure** Terraform state
5. **S3 bucket** for Terraform state storage

## Pre-deployment Steps

### 1. Verify Shared Infrastructure
Ensure the shared infrastructure is deployed and outputs the SQS queue ARN:
```bash
# Check if the shared infrastructure exists and has the required outputs
terraform -chdir=../shared-infrastructure output task_queue_arns
```

Expected output should include:
```hcl
task_queue_arns = {
  "TEXT" = "arn:aws:sqs:us-east-1:123456789012:text-queue"
  # ... other queue types
}
```

### 2. Verify DynamoDB Table
Ensure the `story-metadata` DynamoDB table exists:
```bash
aws dynamodb describe-table --table-name story-metadata --region us-east-1
```

## Deployment Steps

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install Lambda function dependencies
npm run install:story-text-processing
```

### 2. Build Lambda Function
```bash
# Build the TypeScript code
npm run build:story-text-processing
```

### 3. Package Lambda Function
```bash
# Create deployment package
npm run package:story-text-processing
```

### 4. Initialize Terraform
```bash
# Initialize Terraform and download providers
terraform init
```

### 5. Plan Deployment
```bash
# Review the planned changes
terraform plan
```

**Expected Resources:**
- Lambda function: `story-text-processing-lambda`
- IAM role: `story-text-processing-lambda-role`
- IAM policies for DynamoDB and SQS
- SQS event source mapping

### 6. Apply Deployment
```bash
# Deploy the infrastructure
terraform apply
```

Confirm the deployment by typing `yes` when prompted.

## Post-deployment Verification

### 1. Check Lambda Function
```bash
# Verify Lambda function exists
aws lambda get-function --function-name story-text-processing-lambda --region us-east-1
```

### 2. Check IAM Role
```bash
# Verify IAM role exists
aws iam get-role --role-name story-text-processing-lambda-role
```

### 3. Check Event Source Mapping
```bash
# List event source mappings
aws lambda list-event-source-mappings --function-name story-text-processing-lambda --region us-east-1
```

### 4. Test SQS Integration
```bash
# Send a test message to the TEXT queue
aws sqs send-message \
  --queue-url "https://sqs.us-east-1.amazonaws.com/123456789012/text-queue" \
  --message-body '{"body": "Test message for text processing", "messageAttributes": {"task_type": "TEXT"}}' \
  --message-attributes '{"task_type": {"StringValue": "TEXT", "DataType": "String"}}' \
  --region us-east-1
```

### 5. Monitor Processing
```bash
# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/story-text-processing-lambda" --region us-east-1

# Get recent log events
aws logs filter-log-events \
  --log-group-name "/aws/lambda/story-text-processing-lambda" \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --region us-east-1
```

### 6. Verify DynamoDB Records
```bash
# Scan the story-metadata table for recent records
aws dynamodb scan \
  --table-name story-metadata \
  --filter-expression "begins_with(#id, :prefix)" \
  --expression-attribute-names '{"#id": "id"}' \
  --expression-attribute-values '{":prefix": {"S": "story-"}}' \
  --region us-east-1
```

## Troubleshooting

### Common Issues

#### 1. SQS Queue Not Found
**Error**: `Error: InvalidParameterValueException: Invalid event source ARN`
**Solution**: Verify the shared infrastructure is deployed and the TEXT queue exists.

#### 2. DynamoDB Access Denied
**Error**: `AccessDeniedException: User is not authorized to perform: dynamodb:PutItem`
**Solution**: Check IAM role permissions and ensure the role is attached to the Lambda function.

#### 3. Lambda Function Not Triggered
**Issue**: Messages in SQS queue but Lambda not processing
**Solution**: 
- Check event source mapping status
- Verify Lambda function is active
- Check CloudWatch logs for errors

#### 4. Build Errors
**Error**: TypeScript compilation failures
**Solution**: 
- Ensure Node.js version >= 18.0.0
- Run `npm run clean` and rebuild
- Check TypeScript configuration

### Debug Commands

```bash
# Check Lambda function configuration
aws lambda get-function-configuration --function-name story-text-processing-lambda --region us-east-1

# Check IAM role policies
aws iam list-attached-role-policies --role-name story-text-processing-lambda-role

# Check SQS queue attributes
aws sqs get-queue-attributes --queue-url "https://sqs.us-east-1.amazonaws.com/123456789012/text-queue" --attribute-names All --region us-east-1

# Test Lambda function directly
aws lambda invoke \
  --function-name story-text-processing-lambda \
  --payload file://story-text-processing/src/test-event.json \
  --region us-east-1 \
  response.json
```

## Cleanup

To remove the deployed resources:
```bash
terraform destroy
```

**Warning**: This will delete all resources created by this Terraform configuration.

## Monitoring and Maintenance

### Regular Checks
1. **CloudWatch Metrics**: Monitor Lambda invocation count, duration, and errors
2. **SQS Metrics**: Check queue depth and processing rate
3. **DynamoDB Metrics**: Monitor read/write capacity and throttling
4. **Cost Monitoring**: Track Lambda and DynamoDB costs

### Updates
1. **Code Changes**: Rebuild and package the Lambda function
2. **Infrastructure Changes**: Update Terraform configuration and apply
3. **Dependencies**: Update package.json and rebuild as needed

### Scaling Considerations
- **Lambda Concurrency**: Adjust based on SQS queue depth
- **Batch Size**: Increase from 1 to process multiple messages per invocation
- **Memory/Timeout**: Adjust based on processing requirements
