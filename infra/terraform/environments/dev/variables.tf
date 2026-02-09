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
