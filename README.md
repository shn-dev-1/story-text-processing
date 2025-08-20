# Story Text Processing Service

This repository contains an AWS Lambda function that processes text messages from an SQS queue and performs CRUD operations on a DynamoDB table.

## Architecture

- **Lambda Function**: `story-text-processing-lambda` - Processes SQS messages
- **Event Source**: SQS queue (task_type = 'TEXT') from shared infrastructure
- **Data Store**: DynamoDB `story-metadata` table
- **Infrastructure**: Managed via Terraform

## Key Features

- **SQS Integration**: Automatically processes messages from the TEXT SQS queue
- **DynamoDB CRUD**: Full CRUD operations on the story-metadata table
- **IAM Security**: Least-privilege access with custom IAM roles and policies
- **Event-Driven**: Triggered automatically when messages arrive in the queue

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18.0.0
- Access to the shared infrastructure Terraform state

## Infrastructure Components

### Lambda Function
- Runtime: Node.js 18.x
- Timeout: 30 seconds
- Memory: 128 MB
- Handler: `index.handler`

### IAM Role
- Basic Lambda execution permissions
- DynamoDB CRUD permissions on story-metadata table
- DynamoDB CRUD permissions on story-video-tasks table
- SQS permissions for message processing

### SQS Integration
- Event source mapping to TEXT queue
- Batch size: 1 message per invocation
- Automatic message deletion after successful processing

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   npm run install:story-text-processing
   ```

2. **Build Lambda Function**
   ```bash
   npm run build:story-text-processing
   ```

3. **Package Lambda Function**
   ```bash
   npm run package:story-text-processing
   ```

4. **Deploy Infrastructure**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

## Development

### Local Development
- Use `npm run build:watch` in the story-text-processing directory for development
- The Lambda function processes SQS events, not HTTP requests

### Testing
- Test with SQS messages in the TEXT queue
- Monitor CloudWatch logs for execution details
- Use DynamoDB console to verify data operations

## Message Processing

The Lambda function processes SQS messages with the following structure:
```json
{
  "body": "Message content to process",
  "messageAttributes": {
    "task_type": "TEXT"
  }
}
```

## Environment Variables

- `NODE_ENV`: Environment (production)
- `DYNAMODB_TABLE`: Name of the story-metadata DynamoDB table

## DynamoDB Tables

The Lambda function has CRUD access to the following DynamoDB tables:
- **story-metadata**: Primary table for storing processed text data
- **story-video-tasks**: Table for managing video generation tasks

## Monitoring

- CloudWatch Logs: `/aws/lambda/story-text-processing-lambda`
- CloudWatch Metrics: Lambda invocation metrics
- SQS Metrics: Queue depth and processing rates

## Troubleshooting

### Common Issues
1. **SQS Permission Errors**: Verify IAM role has SQS permissions
2. **DynamoDB Access Denied**: Check DynamoDB policy in IAM role
3. **Queue Not Found**: Ensure shared infrastructure is deployed

### Debug Steps
1. Check CloudWatch logs for error details
2. Verify IAM role permissions
3. Confirm SQS queue ARN is correct
4. Validate DynamoDB table exists

## Contributing

1. Make changes to the Lambda function code
2. Rebuild and package the function
3. Update Terraform configuration if needed
4. Test with sample SQS messages
5. Deploy changes via Terraform

## License

MIT License
