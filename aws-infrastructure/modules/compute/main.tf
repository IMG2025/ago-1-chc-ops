variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "ecs_security_group_id" { type = string }

resource "aws_ecs_cluster" "main" {
  name = "coreidentity-${var.environment}"
  setting {
    name = "containerInsights"
    value = "enabled"
  }
}

output "cluster_name" { value = aws_ecs_cluster.main.name }
