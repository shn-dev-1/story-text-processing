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

export enum StoryMetaDataStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  POST_PROCESSING = 'POST_PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface StoryMetaDataDDBItem {
  id: string;
  created_by: string;
  status: StoryMetaDataStatus;
  date_created: string;
  date_updated: string;
  media_ids: string[];
}
