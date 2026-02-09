terraform {
  backend "s3" {
    bucket         = "clawforge-terraform-state"
    key            = "environments/dev/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "clawforge-terraform-locks"
    encrypt        = true
  }
}
