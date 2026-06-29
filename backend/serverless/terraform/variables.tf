variable "aws_region" {
  description = "AWS region for the Arcade API."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Resource name prefix."
  type        = string
  default     = "arcade"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "Environment must be dev, test, or prod."
  }
}

variable "google_client_id" {
  description = "Google OAuth Web Client ID used by the portfolio."
  type        = string
  sensitive   = true

  validation {
    condition     = endswith(var.google_client_id, ".apps.googleusercontent.com")
    error_message = "google_client_id must be a Google Web Client ID."
  }
}

variable "allowed_origins" {
  description = "Browser origins allowed to call the Arcade API."
  type        = list(string)
  default = [
    "https://jeremysdemers.com",
    "https://www.jeremysdemers.com",
  ]
}

variable "arcade_secret_arn" {
  description = "ARN of an existing Secrets Manager secret containing the token signing secret."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:secretsmanager:", var.arcade_secret_arn))
    error_message = "arcade_secret_arn must be a Secrets Manager ARN."
  }
}

variable "lambda_memory_size" {
  description = "Lambda memory allocation in MB."
  type        = number
  default     = 512
}

variable "api_throttle_burst_limit" {
  description = "Maximum burst of API requests."
  type        = number
  default     = 20
}

variable "api_throttle_rate_limit" {
  description = "Sustained API requests per second."
  type        = number
  default     = 10
}
