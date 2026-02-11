#!/usr/bin/env bash
# Wrapper that passes .env secrets to Terraform as TF_VAR_ environment variables.
# Usage: ./tf.sh plan | ./tf.sh apply | ./tf.sh destroy
set -euo pipefail

ENV_FILE="$(git rev-parse --show-toplevel)/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "Warning: $ENV_FILE not found" >&2
fi

export TF_VAR_better_auth_secret="${BETTER_AUTH_SECRET:-}"
export TF_VAR_google_client_id="${GOOGLE_CLIENT_ID:-}"
export TF_VAR_google_client_secret="${GOOGLE_CLIENT_SECRET:-}"

terraform "$@"
