# Supabase Auth and protected pages

The existing Supabase email/password, email OTP, recovery, sign-out and HttpOnly cookie refresh flows are retained. This change adds server-side page protection to `/app` and `/app/*`. `/login` remains public; signed-in root requests redirect to `/app`.

Protected page requests validate the token using Supabase `getUser`, then check active workspace membership. Unauthenticated visitors redirect to login; membership failures return 403; unavailable verification fails closed. Responses use no-store. The existing state/user APIs retain their independent authentication and authorization checks. Browser navigation uses `/app/dashboard`, `/app/leads`, `/app/tasks`, `/app/pipeline`, `/app/proposals`, `/app/content`, `/app/activities`, `/app/reports`, and `/app/settings`.

Auth clients are created per server request to avoid sharing mutable session state. Role decisions use database memberships, not editable user metadata. No service key is exposed to the frontend.

Deployment: use the Express entrypoint `src/app.js` for page requests, including `/app/*`; do not configure a static hosting fallback that bypasses it. Existing server variables SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL and secure production cookie settings remain required. APP_URL and Supabase allowed redirect URLs must match the deployed HTTPS origin. Public registration stays disabled unless explicitly enabled; do not change invite-only access unintentionally.

No cloud Auth settings, user accounts, RLS policies or migrations were changed in this task. Live password/OTP recovery and production deployment must be tested with a dedicated test account; existing signed-in sessions were not logged out for testing.

Reference: https://supabase.com/docs/reference/javascript/auth-getuser
