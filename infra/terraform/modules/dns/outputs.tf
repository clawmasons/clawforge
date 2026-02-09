output "zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "zone_name_servers" {
  description = "NS records — update your domain registrar with these"
  value       = aws_route53_zone.main.name_servers
}

output "cloudfront_certificate_arn" {
  value = aws_acm_certificate_validation.cloudfront.certificate_arn
}

output "api_certificate_arn" {
  value = aws_acm_certificate_validation.api.certificate_arn
}
