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
    key    = "dev/terraform.tfstate"
    region = "us-east-2"
  }
}

provider "aws" {
  region = "us-east-2"
  
  default_tags {
    tags = {
      Project     = "CoreIdentity"
      Environment = "dev"
      ManagedBy   = "Terraform"
    }
  }
}

# Networking Module
module "networking" {
  source      = "../../modules/networking"
  environment = "dev"
}

# Application Load Balancer Module
module "alb" {
  source             = "../../modules/alb"
  environment        = "dev"
  vpc_id             = module.networking.vpc_id
  public_subnet_ids  = module.networking.public_subnet_ids
}

# Compute Module (ECS)
module "compute" {
  source                = "../../modules/compute"
  environment           = "dev"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id
  alb_security_group_id = module.alb.alb_security_group_id
  target_group_arn      = module.alb.target_group_arn
}

# Database Module
module "database" {
  source      = "../../modules/database"
  environment = "dev"
}

# Storage Module
module "storage" {
  source      = "../../modules/storage"
  environment = "dev"
}

# Outputs
output "application_url" {
  value       = "http://${module.alb.alb_dns_name}"
  description = "🚀 Access your application here"
}

output "alb_dns_name" {
  value       = module.alb.alb_dns_name
  description = "Load balancer DNS name"
}

output "ecs_cluster_name" {
  value       = module.compute.cluster_name
  description = "ECS cluster name"
}

output "database_endpoint" {
  value       = module.database.endpoint
  description = "Database endpoint"
  sensitive   = true
}

output "vpc_id" {
  value       = module.networking.vpc_id
  description = "VPC ID"
}

output "deployment_summary" {
  value = <<-EOT
  
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║         🎉 DEPLOYMENT COMPLETE!                      ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  
  Your CoreIdentity platform is now running!
  
  🌐 Application URL:
     http://${module.alb.alb_dns_name}
  
  📊 Infrastructure:
     • VPC: ${module.networking.vpc_id}
     • ECS Cluster: ${module.compute.cluster_name}
     • Load Balancer: ${module.alb.alb_dns_name}
     • Database: Running
  
  💰 Monthly Cost: ~$170 (or $0 with AWS Activate)
  
  🚀 Ready for customer demos and pilots!
  
  EOT
  description = "Deployment summary"
}
