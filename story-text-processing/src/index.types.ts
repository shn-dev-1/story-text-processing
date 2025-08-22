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
  task_ids: {
    [key in StoryVideoTaskType]?: string[];
  };
}

export enum StoryVideoTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum StoryVideoTaskType {
  TTS = 'TTS',
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  SUBTITLE = 'SUBTITLE'
}

export interface StoryVideoTaskDDBItem {
  id: string;
  task_id: string;
  type: StoryVideoTaskType;
  status: StoryVideoTaskStatus;
  date_created: string;
  date_updated: string;
  source_prompt: string;
  media_url?: string;
  sparse_gsi_hash_key?: string;
}

export interface StorySegment {
  text: string;
  imagePrompt: string;
}