output "story_text_processing_lambda_function_name" {
  description = "Name of the story-text-processing Lambda function"
  value       = aws_lambda_function.story_text_processing_lambda.function_name
}

output "story_text_processing_lambda_function_arn" {
  description = "ARN of the story-text-processing Lambda function"
  value       = aws_lambda_function.story_text_processing_lambda.arn
}

output "story_text_processing_lambda_function_invoke_arn" {
  description = "Invocation ARN of the story-text-processing Lambda function"
  value       = aws_lambda_function.story_text_processing_lambda.invoke_arn
}

output "story_text_processing_lambda_role_arn" {
  description = "ARN of the story-text-processing Lambda execution role"
  value       = aws_iam_role.story_text_processing_lambda_role.arn
}

output "sqs_event_source_mapping_id" {
  description = "ID of the SQS event source mapping"
  value       = aws_lambda_event_source_mapping.story_text_processing_sqs_mapping.id
}

output "sqs_queue_arn" {
  description = "ARN of the TEXT SQS queue being processed"
  value       = data.terraform_remote_state.shared_infrastructure.outputs.task_queue_arns["TEXT"]
}

output "story_metadata_table_arn" {
  description = "ARN of the story-metadata DynamoDB table"
  value       = data.aws_dynamodb_table.story_metadata.arn
}

output "story_video_tasks_table_arn" {
  description = "ARN of the story-video-tasks DynamoDB table"
  value       = data.aws_dynamodb_table.story_video_tasks.arn
}
