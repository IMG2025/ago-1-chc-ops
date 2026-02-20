terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "coreidentity-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-2"
  }
}

provider "aws" {
  region = "us-east-2"
  
  default_tags {
    tags = {
      Project     = "CoreIdentity"
      Environment = "prod"
      ManagedBy   = "Terraform"
    }
  }
}

module "networking" {
  source      = "../../modules/networking"
  environment = "prod"
  vpc_cidr    = "10.1.0.0/16"
}

module "compute" {
  source                = "../../modules/compute"
  environment           = "prod"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id
}

module "database" {
  source      = "../../modules/database"
  environment = "prod"
}

module "storage" {
  source      = "../../modules/storage"
  environment = "prod"
}

output "cluster_name" {
  value = module.compute.cluster_name
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "vpc_id" {
  value = module.networking.vpc_id
}
