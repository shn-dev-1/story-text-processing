import { SQSEvent, SQSRecord, SQSBatchResponse } from 'aws-lambda';

export interface StoryTextMessage {
  body: string;
  messageAttributes?: {
    task_type?: string;
    [key: string]: any;
  };
}

export interface StoryTextRecord extends SQSRecord {
  body: string;
  messageAttributes?: {
    task_type?: {
      stringValue: string;
    };
    [key: string]: any;
  };
}

export interface StoryTextEvent extends SQSEvent {
  Records: StoryTextRecord[];
}

export interface StoryTextResponse {
  message: string;
  processedPayload: string;
  timestamp: string;
  status: 'success' | 'error';
  error?: string;
}

export interface DynamoDBItem {
  id: string;
  payload: string;
  timestamp: string;
  status: string;
  processedAt?: string;
  processingResult?: string;
}
