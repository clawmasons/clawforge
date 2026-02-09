# Lessons Learned

_(Updated as corrections happen)_

## 2026-02-09: Lambda Function URL OAC 403 — Missing `lambda:InvokeFunction`

**Problem**: CloudFront OAC + Lambda Function URL returned 403 "Forbidden" despite correct OAC config (`type=lambda`, `sigv4`, `always`) and resource policy with `lambda:InvokeFunctionUrl`.

**Root Cause**: Since October 2025, AWS Lambda function URLs require BOTH `lambda:InvokeFunctionUrl` AND `lambda:InvokeFunction` in the resource policy. The `terraform-aws-open-next` module (v3.2.0) only grants `InvokeFunctionUrl`.

**Why it was hard to find**: SigV4-signed requests via `awscurl` (using IAM user credentials) worked fine — because the user's identity-based IAM policy already included `lambda:InvokeFunction`. Only the CloudFront service principal (which relies solely on the Lambda resource policy) was affected.

**Fix**: Added `aws_lambda_permission` resources granting `lambda:InvokeFunction` to `cloudfront.amazonaws.com` for each function/alias combination in `infra/terraform/modules/web/main.tf`.

**Debugging approach (for next time)**: When Lambda function URL returns 403 with OAC:
1. Test with `awscurl --service lambda` (SigV4 with your creds) — if this works but CloudFront doesn't, the issue is in the resource policy
2. Check for BOTH `lambda:InvokeFunctionUrl` AND `lambda:InvokeFunction` permissions
3. Don't change `AuthType` during debugging — it causes propagation delays and compounds confusion

**Also learned**: `terraform apply -replace=<resource>` bypasses `lifecycle { ignore_changes }` for force-replacing resources — no need to change module config.
