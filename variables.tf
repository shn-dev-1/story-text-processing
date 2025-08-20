variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "story-text-processing-lambda"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 128
}

variable "lambda_runtime" {
  description = "Lambda function runtime"
  type        = string
  default     = "nodejs18.x"
}

variable "sqs_batch_size" {
  description = "Number of SQS messages to process in a single Lambda invocation"
  type        = number
  default     = 1
}

variable "openai_api_key" {
  description = "OpenAI API key for GPT-5 integration"
  type        = string
  sensitive   = true
  default     = ""
}


