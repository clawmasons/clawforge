output "name_servers" {
  description = "Update your domain registrar with these NS records"
  value       = module.dns.zone_name_servers
}

output "api_endpoint" {
  value = module.api.api_custom_domain
}

output "web_cloudfront_distribution_id" {
  value = module.web.cloudfront_distribution_id
}

output "db_proxy_endpoint" {
  value     = module.database.proxy_endpoint
  sensitive = true
}
