# Nazoft Meta Lead Ads setup

## Implemented

One Nazoft-owned Meta app supports client connections. CRM administrators authorize Pages through Meta, choose a fallback employee, and enable Page leadgen subscriptions. Page tokens are encrypted using AES-256-GCM with organization/Page binding, never included in browser workspace state. OAuth state is single-use, expires in ten minutes, and is bound to the signed-in administrator and organization. Webhooks require Meta's raw-body HMAC signature. Lead IDs are deduplicated transactionally. Campaign keyword rules run before fallback assignment; only active members can receive leads. One Page cannot be connected to two organizations.

Test access now makes real Graph API calls rather than displaying a canned success message. Disconnect removes the subscription and encrypted token, not existing CRM leads.

## Required operator setup — not yet performed

1. Create/configure the Nazoft business app in Meta, complete required business verification/App Review, and create a Facebook Login for Business configuration for client Page access.
2. Set these **server-only** environment variables in the deployment's secret settings (never in frontend/public variables or chat):
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_LOGIN_CONFIG_ID`
   - `META_GRAPH_VERSION` — supported version from the app dashboard, for example the version selected when configuring the app; no version is assumed in code.
   - `META_TOKEN_ENCRYPTION_KEY` — 32 cryptographically random bytes represented as 64 hexadecimal characters. Keep a secure backup; losing it requires reconnecting Pages.
   - `META_WEBHOOK_VERIFY_TOKEN` — a separate long random verification string.
   - `APP_URL=https://crm.nazoft.com` (or the actual HTTPS deployment).
3. Apply `migrations/004_meta_connections.sql` using the existing migration process. These tables deliberately have RLS with no browser access policies. Server database credentials must be able to access them.
4. Configure the exact OAuth redirect URL: `https://crm.nazoft.com/api/meta?action=callback`.
5. Configure the Page webhook callback: `https://crm.nazoft.com/api/meta?action=webhook`; enter the verification token from secret storage and subscribe to `leadgen`.
6. Configure permissions needed for Page listing/subscription, form/lead retrieval and campaign attribution. Validate `pages_show_list`, `pages_manage_metadata`, `leads_retrieval`, and the Page/ads permissions required for your approved use case against Meta's current dashboard. Do not assume development-mode access permits public client onboarding.
7. In CRM Settings → Meta Ads: Connect Meta → authorize Pages → select the fallback user → Enable sync → Test access.
8. Use Meta's Lead Ads Testing Tool to submit a disposable test lead. Verify its campaign, owner, tenant visibility, duplicate delivery handling, and retained lead after an older CRM tab saves. Test reconnect, permission revocation, and disconnect too.

## Verification and limits

- Local automated tests cover encryption isolation, webhook signature rejection, OAuth/deduplication contracts and existing campaign routing tests. Live OAuth, permissions, Page subscription and delivery are **unverified** without credentials and Meta approval.
- Meta documentation endpoints returned HTTP 429 during development. Confirm current permissions, Login configuration and Graph behavior before releasing to customers:
  - https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
  - https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/
- Only newly delivered leadgen events are ingested; historical lead backfill is not implemented.
- Campaign lookup failure returns an error instead of silently routing to the wrong employee. Check ads permissions if delivery retries.
- Webhook processing is synchronous and returns non-success on retrieval/database failure so Meta can retry. For high-volume production, add a durable queue and operational retry dashboard before launch; multi-event batches can exceed serverless execution limits.
- New webhook leads appear after refreshing the CRM. Existing tabs are protected from erasing unseen Meta leads during autosave, but live push updates are not implemented.
- No environment secrets, production migration, Meta subscriptions, or deployments were changed as part of this implementation.
