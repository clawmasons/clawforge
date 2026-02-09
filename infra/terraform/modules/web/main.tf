terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.46.0"
      configuration_aliases = [
        aws.dns,
        aws.iam,
        aws.server_function,
        aws.global,
      ]
    }
  }
}

data "aws_region" "current" {}

module "open_next" {
  source  = "RJPearson94/open-next/aws//modules/tf-aws-open-next-zone"
  version = "3.2.0"

  prefix             = "${var.project}-web"
  folder_path        = var.open_next_build_path
  open_next_version  = "v3.x.x"
  zone_suffix        = var.domain_name

  function_architecture = "arm64"

  server_function = {
    runtime                 = "nodejs22.x"
    memory_size             = 512
    timeout                 = 29
    backend_deployment_type = "REGIONAL_LAMBDA_WITH_OAC"
    enable_streaming        = true

    additional_environment_variables = {
      NEXT_PUBLIC_API_URL = "https://api.${var.domain_name}"
    }
  }

  image_optimisation_function = {
    runtime                 = "nodejs22.x"
    memory_size             = 512
    timeout                 = 25
    backend_deployment_type = "REGIONAL_LAMBDA_WITH_OAC"
  }

  distribution = {
    price_class = "PriceClass_100"
  }

  domain_config = {
    include_www = true
    hosted_zones = [{
      name = var.domain_name
    }]
    viewer_certificate = {
      acm_certificate_arn = var.cloudfront_certificate_arn
    }
  }

  scripts = {
    additional_environment_variables = {
      AWS_REGION = data.aws_region.current.name
    }
  }

  providers = {
    aws                 = aws
    aws.dns             = aws.dns
    aws.iam             = aws.iam
    aws.server_function = aws.server_function
    aws.global          = aws.global
  }
}

# Workaround: Since Oct 2025, Lambda function URLs require both
# lambda:InvokeFunctionUrl AND lambda:InvokeFunction in the resource policy.
# The open-next module (v3.2.0) only grants InvokeFunctionUrl.
# See: https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html

data "aws_caller_identity" "current" {}

locals {
  distribution_arn = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${module.open_next.cloudfront_distribution_id}"
  oac_functions = {
    server             = "${var.project}-web-server-function"
    image-optimisation = "${var.project}-web-image-optimization-function"
  }
  oac_aliases = ["nextjs", "opennext"]
  oac_permissions = merge([
    for fn_key, fn_name in local.oac_functions : {
      for alias in local.oac_aliases : "${fn_key}-${alias}" => {
        function_name = fn_name
        qualifier     = alias
      }
    }
  ]...)
}

resource "aws_lambda_permission" "oac_invoke_function" {
  for_each = local.oac_permissions

  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  qualifier     = each.value.qualifier
  principal     = "cloudfront.amazonaws.com"
  source_arn    = local.distribution_arn
}
