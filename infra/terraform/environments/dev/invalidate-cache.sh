#!/usr/bin/env bash
# Invalidates the CloudFront cache for clawforge.
set -euo pipefail

DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?contains(@,'clawforge')]].Id" \
  --output text)

if [[ -z "$DIST_ID" ]]; then
  echo "Error: no CloudFront distribution found for clawforge" >&2
  exit 1
fi

echo "Invalidating distribution $DIST_ID ..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
