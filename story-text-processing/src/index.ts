import { SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandInput, PutCommand, PutCommandInput, BatchWriteCommand, QueryCommand, QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from 'openai';
import { StoryTextEvent, StoryMetaDataStatus, StoryVideoTaskStatus, StoryVideoTaskDDBItem, StoryVideoTaskType, StorySegment } from './index.types';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

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
    try{
        // Check if TEXT video task record already exists to prevent duplicates
        const existingTextTask = await getExistingTextVideoTask(message.id);
        
        if (existingTextTask) {
            console.log(`TEXT record already exists for story ${message.id}, exiting to prevent duplicate processing`);
            return; // Exit the function early
        }
        
        console.log(`Creating new TEXT record for story ${message.id}`);
        const textVideoTaskRecord = makeVideoTaskRecord(message.id, storyPrompt, StoryVideoTaskType.TEXT, StoryVideoTaskStatus.IN_PROGRESS);
        await createVideoTaskRecord(textVideoTaskRecord);
        
        await updateStoryMetadataRecord(message.id, StoryMetaDataStatus.IN_PROGRESS);
        const processedText = await processText(storyPrompt);

        // Verify that processedText is a valid JSON array and that each object in the array has a "text" and "imagePrompt" key
        const validatedStorySegments = validateStoryTextResponse(processedText);
        
        // Upload the processed text response to S3
        const textResponseS3Uri = await uploadStoryResponseToS3(message.id, textVideoTaskRecord.task_id, processedText);
        
        // Log the processing result
        console.log(`Text processing complete. Original: "${storyPrompt}" -> Processed: "${processedText}"`);
        console.log(`Message ${record.messageId} processed successfully`);

        // Batch create video-task records for TTS and images based on validated segments
        const videoTaskRecords: StoryVideoTaskDDBItem[] = [];
        
        // Create TTS tasks for each text segment
        validatedStorySegments.forEach(segment => {
          const ttsTaskRecord = makeVideoTaskRecord(message.id, segment.text, StoryVideoTaskType.TTS, StoryVideoTaskStatus.PENDING);
          videoTaskRecords.push(ttsTaskRecord);
        });
        
        // Create IMAGE tasks for each image prompt
        validatedStorySegments.forEach(segment => {
          const imageTaskRecord = makeVideoTaskRecord(message.id, segment.imagePrompt, StoryVideoTaskType.IMAGE, StoryVideoTaskStatus.PENDING);
          videoTaskRecords.push(imageTaskRecord);
        });
        
        await batchCreateVideoTaskRecords(videoTaskRecords);
        
        // Create a map of task types to arrays of task IDs
        const taskIdsByType: { [key in StoryVideoTaskType]?: string[] } = {
          [StoryVideoTaskType.TEXT]: [textVideoTaskRecord.task_id],
          [StoryVideoTaskType.TTS]: videoTaskRecords
            .filter(record => record.type === StoryVideoTaskType.TTS)
            .map(record => record.task_id),
          [StoryVideoTaskType.IMAGE]: videoTaskRecords
            .filter(record => record.type === StoryVideoTaskType.IMAGE)
            .map(record => record.task_id)
        };
        
        // Set text video task record to complete with S3 URI
        await updateVideoTaskRecordStatus(textVideoTaskRecord.id, textVideoTaskRecord.task_id, StoryVideoTaskStatus.COMPLETED, textResponseS3Uri);
        
        // Log the task IDs organized by type for visibility
        console.log(`Task IDs organized by type:`, JSON.stringify(taskIdsByType, null, 2));
        
        // Update metadata record with task IDs organized by type and set status to COMPLETED
        await updateStoryMetadataRecordAsComplete(message.id, taskIdsByType);
        //TODO: Send SNS message for all text video task records
    } catch (error) {
        console.error('Error processing text:', error);
        await updateStoryMetadataRecord(message.id, StoryMetaDataStatus.FAILED);
    }
    
  } catch (error) {
    console.error(`Error processing message ${record.messageId}:`, error);
    throw error; // Re-throw to mark this message as failed
  }
}

async function processText(text: string): Promise<string> {
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
      ]
    });
    
    const processedText = completion.choices[0]?.message?.content || text;
    console.log(`OpenAI response received: ${processedText.substring(0, 100)}${processedText.length > 100 ? '...' : ''}`);
    
    return processedText;
}

function validateStoryTextResponse(responseText: string): StorySegment[] {
  try {
    // Parse the JSON response
    const parsed = JSON.parse(responseText);
    
    // Check if it's an array
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    
    // Validate each segment
    const validatedSegments: StorySegment[] = [];
    
    for (let i = 0; i < parsed.length; i++) {
      const segment = parsed[i];
      
      // Check if segment is an object
      if (typeof segment !== 'object' || segment === null) {
        throw new Error(`Segment at index ${i} is not an object`);
      }
      
      // Check if required properties exist and are strings
      if (typeof segment.text !== 'string') {
        throw new Error(`Segment at index ${i} missing or invalid 'text' property`);
      }
      
      if (typeof segment.imagePrompt !== 'string') {
        throw new Error(`Segment at index ${i} missing or invalid 'imagePrompt' property`);
      }
      
      // Add validated segment
      validatedSegments.push({
        text: segment.text,
        imagePrompt: segment.imagePrompt
      });
    }
    
    console.log(`Successfully validated ${validatedSegments.length} story segments`);
    return validatedSegments;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Story text response validation failed:', errorMessage);
    console.error('Raw response:', responseText);
    
    // Re-throw the error to trigger the error handling block
    throw new Error(`Story text validation failed: ${errorMessage}`);
  }
}

async function updateStoryMetadataRecord(id: string, status: StoryMetaDataStatus): Promise<void> {
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
      ':status': status,
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

async function updateStoryMetadataRecordAsComplete(
  id: string, 
  taskIdsByType: { [key in StoryVideoTaskType]?: string[] }
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  const dynamoParams: UpdateCommandInput = {
    TableName: process.env['STORY_METADATA_DYNAMODB_TABLE'],
    Key: {
      id
    },
    UpdateExpression: 'SET #task_ids = :task_ids, #status = :status, #date_updated = :date_updated',
    ExpressionAttributeNames: {
      '#task_ids': 'task_ids',
      '#status': 'status',
      '#date_updated': 'date_updated'
    },
    ExpressionAttributeValues: {
      ':task_ids': taskIdsByType,
      ':status': StoryMetaDataStatus.COMPLETED,
      ':date_updated': timestamp
    }
  };
  
  try {
    await dynamodb.send(new UpdateCommand(dynamoParams));
    console.log(`Task IDs map and status updated in DynamoDB successfully with ID: ${id}`);
    console.log(`Task IDs by type:`, JSON.stringify(taskIdsByType, null, 2));
  } catch (error) {
    console.error('Error updating task IDs map and status in DynamoDB:', error);
    throw error;
  }
}



function makeVideoTaskRecord(parentId: string, storyPrompt: string, type: StoryVideoTaskType, status: StoryVideoTaskStatus): StoryVideoTaskDDBItem {
    const task_id = randomBytes(8).toString('hex');
    return {
        id: parentId, 
        task_id,
        type,
        status,
        source_prompt: storyPrompt,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        pending_task_id: parentId
    }
}

async function createVideoTaskRecord(videoTaskRecord: StoryVideoTaskDDBItem): Promise<void> {
  const dynamoParams: PutCommandInput = {
    TableName: process.env['STORY_VIDEO_TASKS_DYNAMODB_TABLE'],
    Item: videoTaskRecord
  };
  
  try {
    await dynamodb.send(new PutCommand(dynamoParams));
    console.log(`Video task record created successfully with task_id: ${videoTaskRecord.task_id}`);
  } catch (error) {
    console.error('Error creating video task record in DynamoDB:', error);
    throw error;
  }
}

async function batchCreateVideoTaskRecords(videoTaskRecords: StoryVideoTaskDDBItem[]): Promise<void> {
  if (videoTaskRecords.length === 0) {
    console.log('No video task records to create');
    return;
  }

  // DynamoDB BatchWriteItem can handle up to 25 items per request
  const BATCH_SIZE = 25;
  const batches = [];
  
  // Split records into batches of 25
  for (let i = 0; i < videoTaskRecords.length; i += BATCH_SIZE) {
    batches.push(videoTaskRecords.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Creating ${videoTaskRecords.length} video task records in ${batches.length} batch(es)`);
  
  try {
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      if (!batch) {
        console.warn(`Batch ${batchIndex + 1} is undefined, skipping...`);
        continue;
      }
      
      const tableName = process.env['STORY_VIDEO_TASKS_DYNAMODB_TABLE'];
      if (!tableName) {
        throw new Error('STORY_VIDEO_TASKS_DYNAMODB_TABLE environment variable is not set');
      }
      
      const batchParams = {
        RequestItems: {
          [tableName]: batch.map(record => ({
            PutRequest: {
              Item: record
            }
          }))
        }
      };
      
      await dynamodb.send(new BatchWriteCommand(batchParams));
      console.log(`Batch ${batchIndex + 1}/${batches.length} completed successfully (${batch.length} records)`);
    }
    
    console.log(`All ${videoTaskRecords.length} video task records created successfully`);
  } catch (error) {
    console.error('Error batch creating video task records in DynamoDB:', error);
    throw error;
  }
}

async function updateVideoTaskRecordStatus(
  id: string, 
  taskId: string, 
  status: StoryVideoTaskStatus, 
  mediaUrl?: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Build update expression and values based on whether we're setting media_url
  let updateExpression = 'SET #status = :status, #date_updated = :date_updated';
  let expressionAttributeNames: { [key: string]: string } = {
    '#status': 'status',
    '#date_updated': 'date_updated'
  };
  let expressionAttributeValues: { [key: string]: any } = {
    ':status': status,
    ':date_updated': timestamp
  };
  
  // If status is COMPLETED, also set media_url and remove pending_task_id
  if (status === StoryVideoTaskStatus.COMPLETED) {
    if (mediaUrl) {
      updateExpression += ', #media_url = :media_url';
      expressionAttributeNames['#media_url'] = 'media_url';
      expressionAttributeValues[':media_url'] = mediaUrl;
    }
    
    // Remove pending_task_id field when task is completed
    updateExpression += ' REMOVE #pending_task_id';
    expressionAttributeNames['#pending_task_id'] = 'pending_task_id';
    // No need to add to expressionAttributeValues for REMOVE operations
  }
  
  const dynamoParams: UpdateCommandInput = {
    TableName: process.env['STORY_VIDEO_TASKS_DYNAMODB_TABLE'],
    Key: {
      id: id,
      task_id: taskId
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  };
  
  try {
    await dynamodb.send(new UpdateCommand(dynamoParams));
    if (status === StoryVideoTaskStatus.COMPLETED) {
      if (mediaUrl) {
        console.log(`Video task record status updated successfully. ID: ${id}, Task ID: ${taskId}, New Status: ${status}, Media URL: ${mediaUrl}, Pending Task ID removed`);
      } else {
        console.log(`Video task record status updated successfully. ID: ${id}, Task ID: ${taskId}, New Status: ${status}, Pending Task ID removed`);
      }
    } else {
      console.log(`Video task record status updated successfully. ID: ${id}, Task ID: ${taskId}, New Status: ${status}`);
    }
  } catch (error) {
    console.error('Error updating video task record status in DynamoDB:', error);
    throw error;
  }
}

async function getExistingTextVideoTask(storyId: string): Promise<StoryVideoTaskDDBItem | null> {
  try {
    // Query for existing TEXT type video task for this story
    const queryParams = {
      TableName: process.env['STORY_VIDEO_TASKS_DYNAMODB_TABLE'],
      KeyConditionExpression: 'id = :storyId',
      FilterExpression: '#type = :taskType',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':storyId': storyId,
        ':taskType': StoryVideoTaskType.TEXT
      }
    };
    
    const result: QueryCommandOutput = await dynamodb.send(new QueryCommand(queryParams));
    
    if (result.Items && result.Items.length > 0) {
      // Return the first TEXT task found
      return result.Items[0] as StoryVideoTaskDDBItem;
    }
    
    return null;
  } catch (error) {
    console.error('Error querying for existing TEXT video task:', error);
    // If query fails, assume no existing record to be safe
    return null;
  }
}

async function uploadStoryResponseToS3(storyId: string, taskId: string, processedText: string): Promise<string> {
  const bucketName = process.env['S3_BUCKET_NAME'];
  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }
  
  // Create folder structure: <storyId>/<taskId>_story_response.json
  const key = `${storyId}/${taskId}_${StoryVideoTaskType.TEXT}.json`;
  
  const uploadParams = {
    Bucket: bucketName,
    Key: key,
    Body: processedText,
    ContentType: 'application/json',
    Metadata: {
      'story-id': storyId,
      'upload-date': new Date().toISOString(),
      'content-type': 'story-response'
    }
  };
  
  await s3Client.send(new PutObjectCommand(uploadParams));
  console.log(`Story response uploaded to S3 successfully. Bucket: ${bucketName}, Key: ${key}`);
  
  // Return the S3 URI of the created object
  const s3Uri = `s3://${bucketName}/${key}`;
  return s3Uri;
}


