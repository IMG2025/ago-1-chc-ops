variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

resource "aws_ecs_cluster" "main" {
  name = "coreidentity-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "coreidentity-${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/coreidentity-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "coreidentity-${var.environment}"
  }
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_id" {
  value = aws_ecs_cluster.main.id
}
