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

### OpenAI Integration

The function integrates with OpenAI GPT-5 to process text content:
- **Model**: GPT-5
- **Max Tokens**: 1000
- **Temperature**: 0.7
- **Fallback**: If OpenAI API call fails, returns original text

## Environment Variables

- `NODE_ENV`: Environment (production)
- `STORY_METADATA_DYNAMODB_TABLE`: Name of the story-metadata DynamoDB table
- `STORY_VIDEO_TASKS_DYNAMODB_TABLE`: Name of the story-video-tasks DynamoDB table
- `OPENAI_API_KEY`: OpenAI API key for GPT-5 integration
- `S3_BUCKET_NAME`: Name of the S3 bucket for story video data (from shared infrastructure)


## DynamoDB Tables

The Lambda function has CRUD access to the following DynamoDB tables:
- **story-metadata**: Primary table for storing processed text data
  - `task_ids`: Map of task types (TEXT, TTS, IMAGE) to arrays of task IDs
  - Status updated to COMPLETED when all tasks are processed
- **story-video-tasks**: Table for managing video generation tasks
  - `media_url`: S3 URI of completed task output (set when status transitions to COMPLETED)
  - `sparse_gsi_hash_key`: Sparse GSI hash key for pending tasks (removed when status transitions to COMPLETED)

## S3 Bucket Access

The Lambda function has read/write access to the story video data S3 bucket:
- **Bucket**: Retrieved from shared infrastructure remote state
- **Permissions**: GetObject, PutObject, DeleteObject, ListBucket, GetBucketLocation
- **Usage**: 
  - Stores processed story responses in JSON format
  - Creates folder structure: `<storyId>/<storyId>_story_response.json`
  - Includes metadata: story-id, upload-date, content-type

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
