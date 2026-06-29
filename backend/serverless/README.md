# Shared serverless Arcade API

This API consolidates Tetris and Neon Shatter authentication, scores, leaderboards, and player statistics into one AWS Lambda function and one DynamoDB table. The existing per-game SQLite APIs remain available for local development.

## Architecture

```text
Portfolio browser
      |
API Gateway HTTP API
      |
Lambda + FastAPI + Mangum
      |
DynamoDB on-demand table
```

Google Identity Services returns an ID token to the browser. The API verifies that token against the configured Web Client ID, stores or updates the player profile, and returns a signed Arcade session token. The signing secret is read from an existing Secrets Manager secret and is never passed through Terraform state.

The DynamoDB table uses these access patterns:

- `USER#<google-subject> / PROFILE` for a player profile
- `USER#<google-subject> / SCORE#<game>#<timestamp>#<id>` for score history
- `game-leaderboard-index` for each game's top ten scores

## Local tests

```bash
cd backend/serverless
python3.14 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

The repository layer expects DynamoDB. The included unit tests cover token handling, identity normalization, and leaderboard ordering without requiring AWS resources.

## Prepare AWS

Create the signing secret once. Do not save its value in a `.tfvars` file:

```bash
aws secretsmanager create-secret \
  --name arcade/prod/token-signing-secret \
  --secret-string "$(openssl rand -hex 48)" \
  --query ARN \
  --output text
```

An encrypted, versioned S3 bucket for Terraform state must also exist before deployment.

## Build and validate

```bash
./backend/serverless/build-lambda.sh
terraform -chdir=backend/serverless/terraform init -backend=false
terraform -chdir=backend/serverless/terraform validate
```

## Deploy

Export the public Google Web Client ID and state bucket name, then review and approve Terraform's plan:

```bash
export TF_VAR_google_client_id="YOUR_CLIENT_ID.apps.googleusercontent.com"
export TF_VAR_arcade_secret_arn="THE_SECRET_ARN_RETURNED_ABOVE"
export ARCADE_TERRAFORM_STATE_BUCKET="YOUR_STATE_BUCKET"
./backend/serverless/deploy.sh prod
```

The script intentionally does not use `-auto-approve`. After deployment, use the `api_url` output for both portfolio game API variables.
