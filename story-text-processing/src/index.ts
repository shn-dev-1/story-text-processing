import { SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, PutCommandInput } from "@aws-sdk/lib-dynamodb";
import { StoryTextEvent } from './index.types';

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
    
    // Process the text (placeholder for actual text processing logic)
    const processedResult = await processText(payload);
    
    // Store the processed result in DynamoDB
    await storeInDynamoDB(payload, processedResult, record.messageId);
    
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

async function storeInDynamoDB(originalPayload: string, processedResult: string, messageId: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const itemId = `story-${Date.now()}-${messageId}`;
  
  const dynamoParams: PutCommandInput = {
    TableName: process.env['DYNAMODB_TABLE'],
    Item: {
      id: itemId,
      payload: originalPayload,
      timestamp: timestamp,
      status: 'processed',
      processedAt: timestamp,
      processingResult: processedResult,
      messageId: messageId
    }
  };
  
  try {
    await dynamodb.send(new PutCommand(dynamoParams));
    console.log(`Data stored in DynamoDB successfully with ID: ${itemId}`);
  } catch (error) {
    console.error('Error storing data in DynamoDB:', error);
    throw error;
  }
}
