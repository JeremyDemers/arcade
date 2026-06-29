output "api_url" {
  description = "Browser-facing Arcade HTTP API URL."
  value       = aws_apigatewayv2_api.arcade.api_endpoint
}

output "dynamodb_table_name" {
  description = "DynamoDB table storing users and scores."
  value       = aws_dynamodb_table.arcade.name
}

output "lambda_function_name" {
  description = "Shared Arcade Lambda function."
  value       = aws_lambda_function.api.function_name
}
