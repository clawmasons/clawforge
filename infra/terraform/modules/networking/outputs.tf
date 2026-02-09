output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "lambda_security_group_id" {
  value = aws_security_group.lambda.id
}

output "rds_proxy_security_group_id" {
  value = aws_security_group.rds_proxy.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}
