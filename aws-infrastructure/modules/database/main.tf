variable "environment" {
  type = string
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_db_instance" "main" {
  identifier           = "coreidentity-${var.environment}"
  engine               = "postgres"
  engine_version       = "15.5"
  instance_class       = var.environment == "prod" ? "db.t3.small" : "db.t3.micro"
  allocated_storage    = 20
  db_name              = "coreidentity"
  username             = "admin"
  password             = random_password.db_password.result
  skip_final_snapshot  = true
  publicly_accessible  = false

  tags = {
    Name = "coreidentity-${var.environment}"
  }
}

output "endpoint" {
  value = aws_db_instance.main.endpoint
}

output "database_name" {
  value = aws_db_instance.main.db_name
}
