# Nazoft CRM production audit

## Confirmed architecture

The frontend is a single HTML/JavaScript application with no frontend framework or client package manager. Express 5 provides local routes; Vercel runs the production `api/` handlers. Supabase supplies PostgreSQL and Auth. There is no configured object-storage bucket or external state-management library.

## Security model

Business data is currently stored as one JSON workspace per organization. A signed-in user never supplies an organization identifier to the state API: the server resolves it from `organization_members`. Additive migrations enable RLS for profiles, organizations, memberships, organization workspaces, the legacy user workspace, and the unused legacy workspace. The service-role key is accepted only by server modules and is required only for invitations.

Roles are enforced for workspace writes at the API layer: viewers are read-only. Admin-only invitations are checked against database membership. Because business records remain in a single JSON document, fine-grained per-lead authorization for sales users is not yet possible; splitting leads, activities, and documents into normalized tenant-owned tables is the next security milestone.

## Authentication findings

The previous OTP and password-reset UI generated a code inside the browser and never contacted an email provider. It has been replaced with Supabase `signInWithOtp`, `verifyOtp`, magic-link exchange, and authenticated password update endpoints. Public sign-up is disabled unless explicitly enabled. Auth endpoints validate input, rate-limit requests, and return user-safe errors.

The Supabase dashboard was found with a localhost Site URL, no redirect allow-list entries, and custom SMTP disabled. Production URL configuration and a real SMTP provider are required for reliable external delivery.

## Current product limitations

- Contacts, companies, tasks, notes, activities, and deals are represented inside lead/workspace objects rather than normalized tables.
- Profile photos and reusable files are not stored in Supabase Storage.
- There is no automated browser suite with authenticated test accounts.
- Inviting an email that already belongs to a different organization still needs an explicit cross-organization assignment workflow; new-user invitations plus role, suspension, and removal controls are implemented.
- The monolithic client should be split into modules before major future feature development.
