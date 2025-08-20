import { SQSEvent, SQSRecord } from 'aws-lambda';

export interface StoryTextRecord extends SQSRecord {
  body: string;
  messageAttributes: {
    task_type?: {
      stringValue: string;
    };
    [key: string]: any;
  };
}

export interface StoryTextEvent extends SQSEvent {
  Records: StoryTextRecord[];
}

export interface DynamoDBItem {
  id: string;
  payload: string;
  timestamp: string;
  status: string;
  processedAt?: string;
  processingResult?: string;
}
