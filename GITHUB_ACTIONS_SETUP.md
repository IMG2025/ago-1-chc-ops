# GitHub Actions AWS Deployment Setup

## Quick Setup (15 minutes)

### 1. Create AWS Account (5 min)
- Go to: https://aws.amazon.com/free
- Sign up for free tier

### 2. Create IAM User (3 min)
- AWS Console → IAM → Users → Create User
- Name: github-actions
- Permissions: AdministratorAccess
- Create access key → Save credentials

### 3. Add GitHub Secrets (2 min)
- GitHub repo → Settings → Secrets → Actions
- Add: AWS_ACCESS_KEY_ID
- Add: AWS_SECRET_ACCESS_KEY

### 4. Create S3 Bucket (3 min)
- AWS Console → S3 → Create bucket
- Name: coreidentity-terraform-state
- Region: us-east-1
- Enable versioning

### 5. Push and Deploy (2 min)
```bash
git add -A
git commit -m "Add AWS deployment"
git push
```

GitHub Actions will deploy automatically!

## View Deployment
- GitHub → Actions tab
- Watch deployment in real-time
- Takes ~20 minutes

## Cost
- Dev: ~$50-100/month
- With AWS Activate credits: $0

Done! 🚀
