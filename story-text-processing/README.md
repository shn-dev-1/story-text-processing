# Story Text Processing Lambda

This Lambda function processes text messages from an SQS queue and stores the results in DynamoDB.

## Function Overview

- **Trigger**: SQS queue (task_type = 'TEXT')
- **Purpose**: Process incoming text messages and store results
- **Output**: DynamoDB records with processed text data
- **Batch Processing**: Supports multiple messages per invocation

## Message Processing Flow

1. **Receive SQS Event**: Lambda is triggered by SQS messages
2. **Parse Message**: Extract text payload from message body
3. **Validate Task Type**: Ensure message is for TEXT processing
4. **Process Text**: Apply text processing logic (currently uppercase conversion)
5. **Store Results**: Save original and processed text to DynamoDB
6. **Handle Failures**: Return batch item failures for failed messages

## Message Format

### Input (SQS Message)
```json
{
  "body": "Text content to process",
  "messageAttributes": {
    "task_type": {
      "stringValue": "TEXT"
    }
  }
}
```

### Output (DynamoDB Item)
```json
{
  "id": "story-{timestamp}-{messageId}",
  "payload": "Original text content",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "processed",
  "processedAt": "2024-01-01T00:00:00.000Z",
  "processingResult": "PROCESSED TEXT CONTENT",
  "messageId": "SQS message ID"
}
```

## Environment Variables

- `DYNAMODB_TABLE`: Name of the story-metadata DynamoDB table
- `NODE_ENV`: Environment (production)

## Dependencies

- `@aws-sdk/client-dynamodb`: DynamoDB client
- `@aws-sdk/lib-dynamodb`: DynamoDB document client utilities
- `@types/aws-lambda`: Lambda type definitions

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run build:watch
```

### Package for Lambda
```bash
npm run package:lambda
```

### Clean Build
```bash
npm run clean
```

## Testing

### Local Testing
1. Create a mock SQS event structure
2. Test the handler function with sample data
3. Verify DynamoDB operations (mock or local)

### AWS Testing
1. Send messages to the TEXT SQS queue
2. Monitor CloudWatch logs for processing
3. Check DynamoDB for stored records

## Error Handling

- **Message-Level Errors**: Individual message failures don't affect other messages
- **Batch Failures**: Failed messages are returned in `batchItemFailures`
- **Critical Errors**: All messages marked as failed if Lambda crashes

## Performance Considerations

- **Batch Size**: Currently set to 1 message per invocation
- **Timeout**: 30 seconds per invocation
- **Memory**: 128 MB allocated
- **Concurrency**: Limited by SQS event source mapping

## Monitoring

- **CloudWatch Logs**: `/aws/lambda/story-text-processing-lambda`
- **Metrics**: Invocation count, duration, errors
- **SQS Metrics**: Queue depth, processing rate

## Future Enhancements

- **Text Processing**: Implement actual text analysis algorithms
- **Batch Processing**: Increase batch size for better throughput
- **Error Retry**: Implement exponential backoff for failed messages
- **Metrics**: Custom CloudWatch metrics for processing statistics
