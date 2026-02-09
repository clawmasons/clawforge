output "db_instance_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "proxy_endpoint" {
  description = "RDS Proxy endpoint for Lambda connections"
  value       = aws_db_proxy.main.endpoint
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "db_name" {
  value = aws_db_instance.main.db_name
}
