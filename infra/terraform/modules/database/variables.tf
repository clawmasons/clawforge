variable "project" {
  description = "Project name"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for DB and proxy"
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group ID for RDS"
  type        = string
}

variable "rds_proxy_security_group_id" {
  description = "Security group ID for RDS Proxy"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "clawforge"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "clawforge"
}
