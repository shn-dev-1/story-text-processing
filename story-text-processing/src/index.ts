import { SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import OpenAI from 'openai';
import { StoryTextEvent, StoryMetaDataStatus } from './index.types';
import * as fs from 'fs';
import * as path from 'path';

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

// Load system message
const systemMessage = fs.readFileSync(path.join(__dirname, 'system_message.txt'), 'utf8');

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
    // Parse the message body (SNS notification)
    const messageBody = JSON.parse(record.body);
    
    // Extract the actual message content from the SNS notification
    const message = JSON.parse(messageBody.Message);
    
    console.log(`Processing message:`, message);
    
    // Validate task type if present
    if (record.messageAttributes?.task_type?.stringValue && 
        record.messageAttributes.task_type.stringValue !== 'TEXT') {
      throw new Error(`Invalid task type: ${record.messageAttributes.task_type.stringValue}`);
    }

    const storyPrompt = message.story_prompt;
    console.log("Story Prompt: ", storyPrompt);
    
    // Process the text with OpenAI GPT-5
    const processedText = await processText(storyPrompt);
    
    // Store the processed result in DynamoDB
    await setMetadataRecordToInProgress(message.id);
    
    // Log the processing result
    console.log(`Text processing complete. Original: "${storyPrompt}" -> Processed: "${processedText}"`);
    
    console.log(`Message ${record.messageId} processed successfully`);
    
  } catch (error) {
    console.error(`Error processing message ${record.messageId}:`, error);
    throw error; // Re-throw to mark this message as failed
  }
}

async function processText(text: string): Promise<string> {
  try {
    console.log(`Processing text with OpenAI GPT-5: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7
    });
    
    const processedText = completion.choices[0]?.message?.content || text;
    console.log(`OpenAI response received: ${processedText.substring(0, 100)}${processedText.length > 100 ? '...' : ''}`);
    
    return processedText;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    // Fallback to original text if OpenAI call fails
    return text;
  }
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
