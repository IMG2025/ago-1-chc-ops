variable "environment" { type = string }

resource "aws_s3_bucket" "artifacts" {
  bucket = "coreidentity-${var.environment}-artifacts-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration { status = "Enabled" }
}

data "aws_caller_identity" "current" {}

output "artifacts_bucket_name" { value = aws_s3_bucket.artifacts.id }
