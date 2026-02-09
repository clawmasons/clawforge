variable "project" {
  description = "Project name"
  type        = string
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
}

variable "open_next_build_path" {
  description = "Path to the OpenNext build output (.open-next directory)"
  type        = string
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront"
  type        = string
}

