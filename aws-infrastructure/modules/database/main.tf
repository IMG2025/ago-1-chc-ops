variable "environment" { type = string }

resource "aws_db_instance" "main" {
  identifier = "coreidentity-${var.environment}"
  engine = "postgres"
  instance_class = "db.t3.micro"
  allocated_storage = 20
  db_name = "coreidentity"
  username = "admin"
  password = "change-me-${var.environment}"
  skip_final_snapshot = true
}

output "endpoint" { value = aws_db_instance.main.endpoint }
