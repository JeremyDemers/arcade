#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STATE_BUCKET="${ARCADE_TERRAFORM_STATE_BUCKET:-}"
ENVIRONMENT="${1:-prod}"

[[ -n "$STATE_BUCKET" ]] || {
  printf 'Set ARCADE_TERRAFORM_STATE_BUCKET before deploying.\n' >&2
  exit 1
}

[[ -n "${TF_VAR_google_client_id:-}" ]] || {
  printf 'Set TF_VAR_google_client_id before deploying.\n' >&2
  exit 1
}

[[ -n "${TF_VAR_arcade_secret_arn:-}" ]] || {
  printf 'Set TF_VAR_arcade_secret_arn before deploying.\n' >&2
  exit 1
}

"$ROOT_DIR/build-lambda.sh"

terraform -chdir="$ROOT_DIR/terraform" init \
  -backend-config="bucket=$STATE_BUCKET" \
  -backend-config="key=arcade/$ENVIRONMENT/terraform.tfstate" \
  -backend-config="region=${AWS_REGION:-us-east-1}" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"

terraform -chdir="$ROOT_DIR/terraform" apply \
  -var="environment=$ENVIRONMENT"

printf '\nArcade API: %s\n' "$(terraform -chdir="$ROOT_DIR/terraform" output -raw api_url)"
