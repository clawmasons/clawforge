variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "project" {
  description = "Project name for resource tagging"
  type        = string
  default     = "clawforge"
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "clawforge.org"
}

variable "better_auth_secret" {
  description = "Secret key for Better Auth session signing"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}
