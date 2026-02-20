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

variable "alb_security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

# ECS Cluster
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

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/coreidentity-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "coreidentity-${var.environment}"
  }
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_execution" {
  name = "coreidentity-${var.environment}-ecs-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "coreidentity-${var.environment}-ecs-execution"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (for application permissions)
resource "aws_iam_role" "ecs_task" {
  name = "coreidentity-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "coreidentity-${var.environment}-ecs-task"
  }
}

# Security Group Rule - Allow ALB to reach ECS tasks
resource "aws_security_group_rule" "ecs_from_alb" {
  type                     = "ingress"
  from_port                = 8080
  to_port                  = 8083
  protocol                 = "tcp"
  security_group_id        = var.ecs_security_group_id
  source_security_group_id = var.alb_security_group_id
  description              = "Allow ALB to reach ECS tasks"
}

data "aws_region" "current" {}

# Sentinel Task Definition
resource "aws_ecs_task_definition" "sentinel" {
  family                   = "coreidentity-${var.environment}-sentinel"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "sentinel"
    image = "nginx:alpine"
    portMappings = [{
      containerPort = 8080
      hostPort      = 8080
      protocol      = "tcp"
    }]
    environment = [{
      name  = "ENVIRONMENT"
      value = var.environment
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "sentinel"
      }
    }
    command = [
      "sh", "-c",
      "echo 'server { listen 8080; location / { return 200 \"Sentinel OS - Governance Layer\\nStatus: Running\\nEnvironment: ${var.environment}\\n\"; add_header Content-Type text/plain; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
    ]
  }])

  tags = {
    Name = "coreidentity-${var.environment}-sentinel"
  }
}

# Sentinel ECS Service
resource "aws_ecs_service" "sentinel" {
  name            = "sentinel"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.sentinel.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "sentinel"
    container_port   = 8080
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_execution
  ]

  tags = {
    Name = "coreidentity-${var.environment}-sentinel"
  }
}

# Outputs
output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_id" {
  value = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.ecs.name
}
