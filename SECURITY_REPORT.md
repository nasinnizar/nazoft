# Nazoft CRM Authentication & Security Review

**Review date:** 3 September 2026
**Scope:** Authentication, session lifecycle, organization authorization, lead isolation, browser-side data exposure, Vercel functions, HTTP security controls, secrets, and production dependencies.

## Executive summary

The review found no known vulnerable production dependencies and no committed Supabase service-role key, JWT, or tracked `.env` file. Ten security/authentication issues were confirmed and fixed. The most important were cached lead data remaining rendered after a session expired, non-admin workspace writes being able to overwrite organization-level state, invitation emails being sent before administrator authorization, and password changes reusing an expired access token after a successful session refresh.

The code now passes the production build and all 25 security/behavior tests. Live local checks confirmed that unauthenticated requests return `401`, state-changing requests without the CRM origin return `403`, malformed same-origin JSON returns `400`, and expired sessions show the sign-in screen without rendering cached client names.

## Confirmed findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | Expired/unauthenticated pages hydrated CRM leads from `localStorage`, leaving client data rendered behind the sign-in overlay. | CRM state now hydrates only from the authenticated server bootstrap. The legacy browser cache is removed after authenticated migration and on explicit sign-out. |
| High | Non-admin workspace saves spread the complete submitted state over organization state, allowing shared configuration/profile/report tampering. | Sales users can now update only their assigned lead data. Managers have an explicit shared-configuration allowlist. Account, user, and report data cannot be overwritten by non-admin saves. |
| High | A non-admin caller could trigger a Supabase invitation email before the later membership function rejected them. | Administrator membership is verified before the invitation API is called in both Express and Vercel handlers. |
| High | Suspended users with no active membership could fall through membership provisioning and receive a new personal administrator workspace. | Existing suspended membership now returns `403` and never reaches organization provisioning. |
| Medium | Password update could fail after automatic session renewal because the handler reused the expired request cookie. | The refreshed access token is attached to the request and used for the password update in both runtime paths. |
| Medium | Email-link exchange validated the access token but trusted a separately supplied refresh token. | The refresh token is now exchanged and its user ID must match the validated access-token user before cookies are issued. |
| Medium | Cookie-authenticated mutation endpoints relied mainly on `SameSite=Lax`. | Origin/Referer and Fetch Metadata validation now protects POST/PUT/PATCH/DELETE requests. Bearer-token clients remain supported. |
| Medium | Vercel authentication rate limiting used process memory, which is not durable across serverless instances. | Migration `003_security_rate_limits.sql` adds a server-only PostgreSQL limiter keyed by a SHA-256 IP/scope digest. Memory is only a logged fallback until the migration is applied. |
| Low | Sensitive API responses did not consistently prevent caching, malformed JSON could become a server error in functions, and production DB certificate verification was disabled. | API responses now use `private, no-store`; malformed JSON returns `400`; production TLS certificate verification defaults to enabled; cookie priority and HTTP headers were aligned. |
| Low | Sign-out only removed browser cookies. | Sign-out now attempts to revoke the Supabase refresh session before clearing cookies. |

## Existing controls verified

- Supabase `getUser()` validates access tokens with the Auth server before authorization decisions.
- Access and refresh tokens are kept in HttpOnly cookies; production cookies are Secure, SameSite=Lax, path-locked, and high priority.
- Public registration is disabled by default; team invitations require a server-only service-role key.
- Organization tables have row-level security and membership/admin policies.
- Lead reads and writes are selected from the authenticated membership, never an organization ID supplied by the browser.
- Admin-only operations validate organization membership and protect the last administrator/self-removal cases.
- CSP, frame denial, content-type protection, permissions policy, referrer policy, and private API caching headers are present.
- Request bodies are limited to 2 MB and validated with Zod at API boundaries.

## Verification evidence

- `pnpm audit --audit-level high`: **No known vulnerabilities found**.
- `pnpm run build`: **passed**; server and all four inline client scripts are syntactically valid.
- `pnpm test`: **19 passed, 0 failed**.
- Secret scan: `.env` is ignored; no tracked service-role value or JWT-shaped secret was found.
- Live local checks: unauthenticated session `401`; missing/untrusted mutation origin `403`; malformed same-origin JSON `400`; sensitive API responses `private, no-store`.
- Browser check: after session expiry, sign-in is visible and the previous client name is absent from the page DOM.

## Production actions still required

1. Apply all migrations, including `003_security_rate_limits.sql`, using `pnpm db:migrate` from a trusted environment.
2. Keep `COOKIE_SECURE=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, and an exact HTTPS `APP_URL` in Vercel Production.
3. Add Vercel Firewall rate-limit rules for `/api/auth/*` as defense in depth and monitor `403`/`429` rates.
4. Verify Supabase Site URL, allowed redirect URLs, SMTP, leaked-password protection, and MFA policy in the Supabase dashboard; those hosted settings cannot be proven from this repository.
5. Plan removal of CSP `'unsafe-inline'` by moving the remaining inline application code/styles into versioned static assets. Until then, input escaping and the restrictive CSP directives reduce risk but do not provide the strongest script-injection protection.
6. Consider requiring recent re-authentication or MFA before password changes and administrator membership changes.

## Limitations

This was a source, dependency, configuration, and local behavior review—not an external penetration test. It did not inspect Vercel project settings, Supabase dashboard settings, SMTP delivery, production logs, firewall rules, or production database grants. Those should be checked during deployment using the actions above.
