terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "story-service-terraform-state"
    key            = "story-text-processing/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "story-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

# Get shared infrastructure outputs from external terraform state
data "terraform_remote_state" "shared_infrastructure" {
  backend = "s3"
  config = {
    bucket = "story-service-terraform-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}

# Get the story-metadata DynamoDB table
data "aws_dynamodb_table" "story_metadata" {
  name = "story-metadata"
}

data "aws_dynamodb_table" "story_video_tasks" {
  name = "story-video-tasks"
}

# Create a ZIP file of the story-text-processing Lambda function code
data "archive_file" "story_text_processing_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/story-text-processing/dist"
  output_path = "${path.module}/story_text_processing_lambda_function.zip"
}

# Create the story-text-processing Lambda function
resource "aws_lambda_function" "story_text_processing_lambda" {
  filename         = data.archive_file.story_text_processing_lambda_zip.output_path
  function_name    = "story-text-processing-lambda"
  role             = aws_iam_role.story_text_processing_lambda_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.story_text_processing_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 300
  memory_size      = 128

  environment {
    variables = {
      NODE_ENV                         = "production"
      STORY_METADATA_DYNAMODB_TABLE    = data.aws_dynamodb_table.story_metadata.name
      STORY_VIDEO_TASKS_DYNAMODB_TABLE = data.aws_dynamodb_table.story_video_tasks.name
      OPENAI_API_KEY                   = var.openai_api_key
    }
  }
}

# IAM role for the story-text-processing Lambda function
resource "aws_iam_role" "story_text_processing_lambda_role" {
  name = "story-text-processing-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "story_text_processing_lambda_basic" {
  role       = aws_iam_role.story_text_processing_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Create custom policy for DynamoDB CRUD operations
resource "aws_iam_role_policy" "story_text_processing_lambda_dynamodb" {
  name = "story-text-processing-lambda-dynamodb-policy"
  role = aws_iam_role.story_text_processing_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          data.aws_dynamodb_table.story_metadata.arn,
          "${data.aws_dynamodb_table.story_metadata.arn}/index/*",
          data.aws_dynamodb_table.story_video_tasks.arn,
          "${data.aws_dynamodb_table.story_video_tasks.arn}/index/*"
        ]
      }
    ]
  })
}

# Create custom policy for SQS permissions
resource "aws_iam_role_policy" "story_text_processing_lambda_sqs" {
  name = "story-text-processing-lambda-sqs-policy"
  role = aws_iam_role.story_text_processing_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = data.terraform_remote_state.shared_infrastructure.outputs.task_queue_arns["TEXT"]
      }
    ]
  })
}

# Create SQS event source mapping for the Lambda function
resource "aws_lambda_event_source_mapping" "story_text_processing_sqs_mapping" {
  event_source_arn = data.terraform_remote_state.shared_infrastructure.outputs.task_queue_arns["TEXT"]
  function_name    = aws_lambda_function.story_text_processing_lambda.function_name
  enabled          = true
  batch_size       = 1
}
