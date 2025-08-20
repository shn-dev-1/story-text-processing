import { SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import { StoryTextEvent, StoryMetaDataStatus } from './index.types';

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event: StoryTextEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: string[] = [];
  
  try {
    console.log(`Processing ${event.Records.length} SQS message(s)`);
    
    // Process each SQS record
    for (const record of event.Records) {
      try {
        await processMessage(record);
        console.log(`Successfully processed message: ${record.messageId}`);
      } catch (error) {
        console.error(`Error processing message ${record.messageId}:`, error);
        batchItemFailures.push(record.messageId);
      }
    }
    
    console.log(`Processing complete. ${event.Records.length - batchItemFailures.length} successful, ${batchItemFailures.length} failed`);
    
    return {
      batchItemFailures: batchItemFailures.length > 0 ? batchItemFailures.map(id => ({ itemIdentifier: id })) : []
    };
    
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    // If there's a critical error, mark all messages as failed
    return {
      batchItemFailures: event.Records.map(record => ({ itemIdentifier: record.messageId }))
    };
  }
};

async function processMessage(record: any): Promise<void> {
  try {
    // Parse the message body
    const messageBody = JSON.parse(record.body);
    const payload = messageBody.body || messageBody.payload || record.body;
    
    console.log(`Processing payload: ${payload}`);
    
    // Validate task type if present
    if (record.messageAttributes?.task_type?.stringValue && 
        record.messageAttributes.task_type.stringValue !== 'TEXT') {
      throw new Error(`Invalid task type: ${record.messageAttributes.task_type.stringValue}`);
    }

    const message = JSON.parse(payload.message);
    const storyPrompt = message.story_prompt;
    console.log("Story Prompt: ", storyPrompt);
    
    // Process the text (placeholder for actual text processing logic)
    await processText(payload);
    
    // Store the processed result in DynamoDB
    await setMetadataRecordToInProgress(message.id);
    
    console.log(`Message ${record.messageId} processed successfully`);
    
  } catch (error) {
    console.error(`Error processing message ${record.messageId}:`, error);
    throw error; // Re-throw to mark this message as failed
  }
}

async function processText(text: string): Promise<string> {
  // Placeholder for actual text processing logic
  // This could include:
  // - Text analysis
  // - Content filtering
  // - Formatting
  // - Sentiment analysis
  // - etc.
  
  console.log(`Processing text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return processed result (for now, just uppercase the text)
  return text.toUpperCase();
}

async function setMetadataRecordToInProgress(id: string): Promise<void> {
  const timestamp = new Date().toISOString();
  
  const dynamoParams: UpdateCommandInput = {
    TableName: process.env['STORY_METADATA_DYNAMODB_TABLE'],
    Key: {
      id
    },
    UpdateExpression: 'SET #status = :status, #date_updated = :date_updated',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#date_updated': 'date_updated'
    },
    ExpressionAttributeValues: {
      ':date_updated': timestamp,
      ':status': StoryMetaDataStatus.IN_PROGRESS,
    }
  };
  
  try {
    await dynamodb.send(new UpdateCommand(dynamoParams));
    console.log(`Data updated in DynamoDB successfully with ID: ${id}`);
  } catch (error) {
    console.error('Error updating data in DynamoDB:', error);
    throw error;
  }
}
