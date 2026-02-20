terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = { source = "hashicorp/aws"; version = "~> 5.0" }
  }
  backend "s3" {
    bucket = "coreidentity-terraform-state"
    key = "dev/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags { tags = { Project = "CoreIdentity"; Environment = "dev" } }
}

module "networking" {
  source = "../../modules/networking"
  environment = "dev"
}

module "compute" {
  source = "../../modules/compute"
  environment = "dev"
  vpc_id = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id
}

module "database" {
  source = "../../modules/database"
  environment = "dev"
}

module "storage" {
  source = "../../modules/storage"
  environment = "dev"
}

output "cluster_name" { value = module.compute.cluster_name }
output "database_endpoint" { value = module.database.endpoint }
