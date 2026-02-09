output "api_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "api_custom_domain" {
  value = "https://api.${var.domain_name}"
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}
