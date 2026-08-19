# MTD Lab

MTD Lab is an HMRC Making Tax Digital application operated by Glomaxel IT Service.

This clean build supports HMRC sandbox OAuth, taxpayer-specific token storage, HMRC Business Details v2.0, Obligations v3.0, and a Supabase-backed taxpayer workspace.

## Environment variables

HMRC_CLIENT_ID
HMRC_CLIENT_SECRET
HMRC_REDIRECT_URI
HMRC_ENVIRONMENT=sandbox
HMRC_STATE_SECRET
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

Never commit secrets or OAuth tokens to GitHub.
