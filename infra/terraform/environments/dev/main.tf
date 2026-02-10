module "networking" {
  source = "../../modules/networking"

  project = var.project
}

module "dns" {
  source = "../../modules/dns"

  domain_name = var.domain_name

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

module "database" {
  source = "../../modules/database"

  project                     = var.project
  private_subnet_ids          = module.networking.private_subnet_ids
  rds_security_group_id       = module.networking.rds_security_group_id
  rds_proxy_security_group_id = module.networking.rds_proxy_security_group_id
}

module "api" {
  source = "../../modules/api"

  project                  = var.project
  domain_name              = var.domain_name
  lambda_source_dir        = "${path.root}/../../../../packages/api/dist-lambda"
  private_subnet_ids       = module.networking.private_subnet_ids
  lambda_security_group_id = module.networking.lambda_security_group_id
  db_proxy_endpoint        = module.database.proxy_endpoint
  db_name                  = module.database.db_name
  db_username              = "clawforge"
  db_secret_arn            = module.database.db_secret_arn
  api_certificate_arn      = module.dns.api_certificate_arn
  zone_id                  = module.dns.zone_id
  better_auth_secret       = var.better_auth_secret
  google_client_id         = var.google_client_id
  google_client_secret     = var.google_client_secret
}

module "web" {
  source = "../../modules/web"

  project                    = var.project
  domain_name                = var.domain_name
  open_next_build_path       = "${path.root}/../../../../packages/web/.open-next"
  cloudfront_certificate_arn = module.dns.cloudfront_certificate_arn

  providers = {
    aws                 = aws
    aws.dns             = aws
    aws.iam             = aws
    aws.server_function = aws
    aws.global          = aws.us_east_1
  }
}
