variable "environment" {
  type = string
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "artifacts" {
  bucket = "coreidentity-${var.environment}-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "coreidentity-${var.environment}-artifacts"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "artifacts_bucket_name" {
  value = aws_s3_bucket.artifacts.id
}
