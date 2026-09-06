import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("organization migration enables RLS and tenant policies", async () => {
  const sql = await read("migrations/002_organizations_and_rls.sql");
  for (const table of ["organizations", "organization_members", "organization_workspaces", "profiles"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /is_organization_member/i);
  assert.match(sql, /is_organization_admin/i);
});

test("workspace access is selected from authenticated membership", async () => {
  const source = await read("src/services/workspace.js");
  assert.match(source, /where m\.user_id = \$1 and m\.status = 'active'/);
  assert.match(source, /organization_id = \$1/);
  assert.match(source, /Your organization access has been suspended/);
  assert.match(source, /account: \{ name: identity\.name, email: identity\.email, photo: "" \}/);
  assert.match(source, /role === "manager"/);
  assert.match(source, /memberFeed/);
  assert.doesNotMatch(source, /where organization_id = request/i);
});

test("browser authentication contains no prototype OTP", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /Prototype OTP|Prototype verification code/);
  assert.match(html, /\/api\/auth\/otp-request/);
  assert.match(html, /\/api\/auth\/otp-verify/);
});

test("password recovery uses Supabase recovery tokens and password fields can be revealed", async () => {
  const html = await read("index.html");
  const expressAuth = await read("src/routes/auth.js");
  const vercelRequest = await read("api/auth/otp-request.js");
  const vercelExchange = await read("api/auth/exchange.js");
  const polish = await read("scripts/interaction-polish.js");
  for (const source of [expressAuth, vercelRequest]) assert.match(source, /resetPasswordForEmail/);
  for (const source of [expressAuth, vercelExchange]) assert.match(source, /purpose === "recovery" \? "recovery" : "email"/);
  assert.match(expressAuth, /\["\/otp\/request", "\/otp-request"\]/);
  assert.match(expressAuth, /\["\/otp\/verify", "\/otp-verify"\]/);
  assert.match(html, /verifyEmailOtp\([^\n]+,'recovery'\)/);
  assert.match(polish, /function addPasswordVisibility/);
  assert.match(polish, /password-visibility-icon/);
  assert.match(polish, /passwordEyeIcon\(!visible\)/);
  assert.match(polish, /aria-pressed/);
});

test("login failures remain visible and accessible", async () => {
  const html = await read("index.html");
  assert.match(html, /id="loginError" role="alert" aria-live="polite"/);
  assert.match(html, /Invalid email or password|error\.message/);
  assert.match(html, /aria-invalid/);
  assert.doesNotMatch(html, /allow cookies|cookies should be enabled/i);
});

test("successful authentication never flashes the sign-in form again", async () => {
  const html = await read("index.html");
  assert.match(html, /function showAuthTransition/);
  assert.match(html, /await authApi\('\/api\/auth\/sign-in'.*await authenticatedSessionReady\(\).*navigating=true.*showAuthTransition\(\);location\.replace\(freshWorkspaceLocation\(\)\)/s);
  assert.match(html, /credentials:'same-origin',cache:'no-store'/);
  assert.match(html, /nazoft-session-recovery/);
  assert.match(html, /finally\{if\(!navigating\)setAuthLoading\(button,false\)\}/);
  assert.match(html, /initialLoader\?\.classList\.add\('is-ready'\)/);
  assert.doesNotMatch(html, /1150/);
});

test("login waits for an authorized workspace and keeps the CRM shell private", async () => {
  const html = await read("index.html");
  const expressSession = await read("src/routes/auth.js");
  const vercelSession = await read("api/auth/session.js");
  const vercel = JSON.parse(await read("vercel.json"));

  assert.match(html, /<html lang="en" class="auth-pending">/);
  assert.match(html, /interactive-widget=resizes-content/);
  assert.match(html, /html\.auth-pending \.app,html\.auth-locked \.app\{display:none!important\}/);
  assert.match(html, /app\.inert=!authenticated/);
  assert.match(html, /login\.inert=authenticated\|\|transitioning/);
  assert.match(html, /result\.workspaceReady===true/);
  assert.match(html, /return `\/app\?session=\$\{Date\.now\(\)\.toString\(36\)\}`/);
  assert.match(expressSession, /const workspace = await getWorkspace\(request\.user\.id\)/);
  assert.match(expressSession, /workspaceReady: true/);
  assert.match(vercelSession, /const workspace = await getWorkspace\(user\.id\)/);
  assert.match(vercelSession, /workspaceReady: true/);

  const protectedPaths = new Set(vercel.headers.filter(rule => rule.headers.some(header => header.key === "Cache-Control" && /private, no-store/.test(header.value))).map(rule => rule.source));
  for (const path of ["/", "/login", "/app", "/app/(.*)", "/index.html"]) assert.ok(protectedPaths.has(path));
});

test("Vercel stays within the project's serverless function limit", async () => {
  const apiFiles = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile() && entry.name.endsWith(".js")) apiFiles.push(path);
    }
  }
  await collect(new URL("../api/", import.meta.url));
  assert.ok(apiFiles.length <= 11, `This Vercel project deploys at most 11 functions; found ${apiFiles.length}`);
  const vercel = JSON.parse(await read("vercel.json"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/api/auth/otp-verify" && rule.destination === "/api/auth/exchange?flow=otp"));
  assert.match(await read("api/auth/exchange.js"), /request\.query\?\.flow === "otp"/);
});

test("local Supabase connections can use the IPv4 session pooler", async () => {
  const env = await read("src/config/env.js");
  const pool = await read("src/db/pool.js");
  const tls = await read("src/db/tls.js");
  assert.match(env, /SUPABASE_DB_POOLER_REGION/);
  assert.match(env, /default\("ap-south-1"\)/);
  assert.match(pool, /aws-0-\$\{env\.SUPABASE_DB_POOLER_REGION\}\.pooler\.supabase\.com/);
  assert.match(pool, /connection\.username = `postgres\.\$\{direct\[1\]\}`/);
  assert.match(pool, /connection\.port = "5432"/);
  assert.match(pool, /databaseSslOptions/);
  assert.match(pool, /supabase-root-2021-ca\.crt/);
  assert.match(pool, /pool\.on\("error"/);
  assert.match(tls, /\.pooler\.supabase\.com/);
  assert.match(tls, /caCertificate/);
});

test("CRM forms use the shared responsive horizontal field pattern", async () => {
  const html = await read("index.html");
  const app = await read("src/app.js");
  const script = await read("scripts/form-layout.js");
  const styles = await read("styles/form-layout.css");
  const component = await read("components/ui/v-label-14.tsx");

  assert.match(html, /form-layout\.css\?v=1/);
  assert.match(html, /form-layout\.js\?v=1/);
  assert.match(app, /'form-layout\.js'/);
  assert.match(script, /crm-horizontal-form/);
  assert.match(script, /MutationObserver/);
  assert.match(styles, /grid-template-columns:minmax\(112px,144px\) minmax\(0,1fr\)/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(component, /grid-cols-\[100px_1fr\]/);
  assert.match(component, /useId/);
});

test("regional settings cover country, currency, locale, and time zone", async () => {
  const html = await read("index.html");
  const app = await read("src/app.js");
  const regional = await read("scripts/regional-settings.js");
  assert.match(html, /regional-settings\.js\?v=1/);
  assert.match(app, /\/scripts\/regional-settings\.js/);
  assert.match(regional, /Intl\.supportedValuesOf/);
  assert.match(regional, /Business country/);
  assert.match(regional, /Currency/);
  assert.match(regional, /Time zone/);
  assert.match(regional, /Number & date language/);
  assert.match(regional, /accountPreferences/);
  assert.match(regional, /buildReportSheets/);
});

test("lead workspace provides direct group and sequence controls", async () => {
  const html = await read("index.html");
  const app = await read("src/app.js");
  const controls = await read("scripts/lead-workspace-controls.js");
  assert.match(html, /lead-workspace-controls\.js\?v=4/);
  assert.match(html, /lead-workspace-controls\.css\?v=4/);
  assert.match(app, /\/scripts\/lead-workspace-controls\.js/);
  assert.match(controls, /drawerGroupSelect/);
  assert.match(controls, /drawerSequenceSelect/);
  assert.match(controls, /lead-followup-panel/);
  assert.match(controls, /lead-primary-actions/);
});

test("switching users starts a fresh session without a stale-session return", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /Return to current session|cancelSwitchUser/);
  assert.match(html, /switchUserButton\.onclick=.*\$\('#logoutMenu'\)\.click\(\)/);
  assert.match(html, /Sign out and switch to another verified user/);
});

test("service role key remains server-only", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY/);
  const envExample = await read(".env.example");
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=/);
});

test("browser experience enhancements are served as JavaScript", async () => {
  const app = await read("src/app.js");
  const html = await read("index.html");
  const experience = await read("scripts/crm-experience.js");
  assert.match(app, /\/scripts\/crm-experience\.js/);
  assert.match(app, /application\/javascript/);
  assert.match(html, /\/scripts\/crm-experience\.js/);
  assert.match(experience, /Notification\.requestPermission/);
  assert.match(experience, /Team work hours/);
  assert.match(experience, /timezoneMode/);
  assert.doesNotMatch(experience, /page-transition-loader/);
  assert.doesNotMatch(experience, /__nazoftPageMotion/);
  assert.match(html, /id="appLoader"[^>]*>[\s\S]*?nazoft-logo\.svg/);
});

test("spreadsheet mapping, branded reports, and notification clearing are available", async () => {
  const app = await read("src/app.js");
  const importExport = await read("scripts/import-export.js");
  const experience = await read("scripts/crm-experience.js");
  assert.match(app, /\/scripts\/report-files\.js/);
  assert.match(app, /\/scripts\/import-export\.js/);
  assert.match(importExport, /Nazoft_CRM_Import_Template\.xlsx/);
  assert.match(importExport, /Map spreadsheet columns/);
  assert.match(importExport, /companyLogo/);
  assert.match(importExport, /createXlsxWorkbook/);
  assert.match(importExport, /createPdfReport/);
  assert.match(experience, /data-notification-clear/);
});

test("lead status is opt-in and timeline entries use durable timestamps", async () => {
  const html = await read("index.html");
  const importExport = await read("scripts/import-export.js");
  assert.match(html, /if\(l\.temperature===undefined\|\|l\.temperature===null\)l\.temperature=''/);
  assert.match(html, /status:'Uncontacted',temperature:'',score:null/);
  assert.match(html, /temperature=\(\{Hot:18,Warm:9,Cold:0\}\[leadTemperature\(l\)\]\?\?0\)/);
  assert.match(importExport, /Choose status/);
  assert.match(importExport, /<span>Lead status<\/span>/);
  assert.match(importExport, /at = Date\.now\(\)/);
  assert.match(importExport, /Earlier activity · exact time unavailable/);
  assert.match(importExport, /timeline-important/);
});

test("client workspace is full-page, scroll-locked, and driven by pipeline stage", async () => {
  const importExport = await read("scripts/import-export.js");
  const css = await read("styles/import-export.css");
  assert.match(importExport, /Pipeline stage/);
  assert.match(importExport, /commitPipelineStage\(currentLead, nextStage, lead\.pipeline\)/);
  assert.match(importExport, /lead-quality \.score-badge/);
  assert.match(importExport, /lead-page-open/);
  assert.match(importExport, /lead-temperature-control/);
  assert.match(css, /#drawer\.drawer\.open/);
  assert.match(css, /--lead-shell-left: 238px/);
  assert.match(css, /inset: var\(--lead-shell-top\) 0 0 var\(--lead-shell-left\)/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /body\.lead-page-open #drawerBackdrop \{ display: none !important; \}/);
  assert.match(css, /body\.lead-page-open #notificationPopover \{ z-index: 140; \}/);
  assert.match(css, /#drawer #clientTimeline \.timeline-important/);
  const html = await read("index.html");
  assert.match(html, /content\.inert=open/);
  assert.doesNotMatch(html, /app\.inert=open/);
});

test("won deals require a positive closed value before creating a client", async () => {
  const html = await read("index.html");
  const css = await read("styles/professional-ui.css");
  assert.match(html, /id="wonConfirmForm"/);
  assert.match(html, /id="wonConfirmValue"[^>]*min="0\.01"[^>]*required/);
  assert.match(html, /stageName==='Won'.*requestWonDetails/);
  assert.match(html, /if\(!Number\.isFinite\(amount\)\|\|amount<=0\)/);
  assert.match(html, /lead\.closedValue=.*commitPipelineStage/);
  assert.match(html, /commitPipelineStage.*finalizeWonLead/s);
  assert.match(css, /\.currency-input \{ grid-template-columns: 58px minmax\(0, 1fr\)/);
  assert.match(css, /\.currency-input > span \{[^}]*border-right: 1px solid/);
});

test("pipeline exposes compact created-date filtering", async () => {
  const html = await read("index.html");
  assert.match(html, /id="pipeDateFilter"/);
  assert.match(html, /pipelineCreatedDateMatches/);
  assert.match(html, /Created today/);
  assert.match(html, /Last 30 days/);
});

test("client timelines remain lead-specific and are cleared on deletion", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /feed\.filter\(item=>item\[1\]===lead\.name\)/);
  assert.match(html, /function clearDeletedLeadTimeline\(lead\)\{if\(lead\)lead\.timeline=\[\]\}/);
  assert.match(html, /clearDeletedLeadTimeline\(removed\)/);
  assert.match(html, /Their client timelines will be removed/);
});

test("sidebar toggle is placed beside SmartFind", async () => {
  const html = await read("index.html");
  assert.match(html, /shellSearch\.insertAdjacentElement\('beforebegin',shellSidebarToggle\)/);
  assert.match(html, /professional-ui\.css\?v=16/);
});

test("open dialogs blur and dim the CRM backdrop", async () => {
  const css = await read("styles/professional-ui.css");
  assert.match(css, /body:has\(\.modal\.open\)::before/);
  assert.match(css, /backdrop-filter: blur\(4px\)/);
  assert.match(css, /z-index: 129/);
});

test("lead assignment is private, transferable, and workspace-numbered", async () => {
  const html = await read("index.html");
  const assignment = await read("scripts/assignment-access.js");
  const workspace = await read("src/services/workspace.js");
  const app = await read("src/app.js");
  assert.match(html, /assignment-access\.js\?v=5/);
  assert.match(html, /professional-ui\.css\?v=16/);
  assert.match(assignment, /function leadVisibleToCurrentUser/);
  assert.match(assignment, /data-reassign-user/);
  assert.match(assignment, /recordCounters/);
  assert.match(assignment, /\[\.\.\.leads, \.\.\.deletedLeads\]/);
  assert.match(workspace, /filterWorkspaceForMember/);
  assert.match(workspace, /mergeWorkspaceForMember/);
  assert.match(workspace, /reassignOrganizationLeads/);
  assert.match(app, /\/scripts\/assignment-access\.js/);
});

test("pipeline guidance and mobile desktop-style navigation are available", async () => {
  const html = await read("index.html");
  const mobileSidebar = await read("scripts/mobile-sidebar.js");
  const app = await read("src/app.js");
  assert.match(html, /id="pipelineDescription">Business Setup Sales · 7 customizable stages/);
  assert.match(html, /mobile-sidebar\.js\?v=\d+/);
  assert.match(mobileSidebar, /mobile-sidebar-open/);
  assert.match(mobileSidebar, /Close navigation/);
  assert.match(app, /\/scripts\/mobile-sidebar\.js/);
});

test("state-changing cookie requests require the CRM origin", async () => {
  const security = await read("src/middleware/request-security.js");
  const app = await read("src/app.js");
  const vercel = await read("src/services/vercel-request.js");
  assert.match(security, /fetchSite === "cross-site" \|\| fetchSite === "same-site"/);
  assert.match(security, /configuredOrigins\(request\)\.has\(source\)/);
  assert.match(app, /app\.use\("\/api", protectMutation\)/);
  assert.match(vercel, /mutationIsSameOrigin\(request\)/);
});

test("expired browser sessions use the refreshed access token", async () => {
  const expressAuth = await read("src/middleware/auth.js");
  const vercel = await read("src/services/vercel-request.js");
  assert.match(expressAuth, /request\.authAccessToken = data\.session\.access_token/);
  assert.match(expressAuth, /request\.authAccessToken \|\| bearer/);
  assert.match(vercel, /request\.nazoftAccessToken = data\.session\.access_token/);
  assert.match(vercel, /request\.nazoftAccessToken \|\| bearer/);
});

test("Vercel session responses cannot reuse an unauthenticated bootstrap", async () => {
  const vercel = await read("src/services/vercel-request.js");
  assert.match(vercel, /no-store, no-cache, must-revalidate/);
  assert.match(vercel, /Vary", "Origin, Sec-Fetch-Site, Cookie/);
  assert.match(vercel, /Expires=\$\{new Date\(Date\.now\(\) \+ accessSeconds/);
});

test("email-link exchange binds access and refresh tokens to the same user", async () => {
  for (const path of ["src/routes/auth.js", "api/auth/exchange.js"]) {
    const source = await read(path);
    assert.match(source, /refreshSession\(\{\s*refresh_token:/);
    assert.match(source, /refreshed\.user\.id !== accessData\.user\.id/);
    assert.match(source, /setSessionCookies\(response, refreshed\.session\)/);
  }
});

test("unauthenticated pages never hydrate cached CRM client data", async () => {
  const html = await read("index.html");
  const experience = await read("scripts/crm-experience.js");
  const assignment = await read("scripts/assignment-access.js");
  assert.match(html, /function loadState\(\)\{try\{if\(!window\.__NAZOFT_AUTHENTICATED__\)return/);
  assert.match(html, /function saveState\(\)\{try\{if\(!window\.__NAZOFT_AUTHENTICATED__\)return/);
  assert.match(experience, /window\.__NAZOFT_AUTHENTICATED__ \? window\.__NAZOFT_REMOTE_STATE__ : null/);
  assert.match(assignment, /window\.__NAZOFT_AUTHENTICATED__ \? window\.__NAZOFT_REMOTE_STATE__ : null/);
});

test("administrator authorization happens before an invitation is sent", async () => {
  for (const path of ["src/routes/users.js", "api/users.js"]) {
    const source = await read(path);
    assert.ok(source.indexOf("await requireOrganizationSeat") < source.indexOf("inviteUserByEmail"));
    assert.match(source, /deleteUser\(/);
  }
});

test("team plans cap seats and role permissions remain administrator controlled", async () => {
  const [migration, service, route, client] = await Promise.all([
    read("migrations/006_team_plans_and_permissions.sql"), read("src/services/workspace.js"),
    read("src/routes/users.js"), read("scripts/team-access.js"),
  ]);
  assert.match(migration, /default 'starter'/);
  assert.match(service, /starter: 5, growth: 15, scale: 50/);
  assert.match(service, /where id = \$1 for update/);
  assert.match(route, /updateOrganizationRolePermissions/);
  assert.match(client, /Roles & permissions/);
  assert.match(client, /team seats used/);
});

test("custom roles support grouped granular permissions without weakening tenant isolation", async () => {
  const [migration, service, route, client] = await Promise.all([
    read("migrations/008_custom_roles.sql"), read("src/services/workspace.js"),
    read("src/routes/users.js"), read("scripts/team-access.js"),
  ]);
  assert.match(migration, /role ~ '\^\[a-z\]/);
  assert.match(migration, /member\.organization_id = organization_workspaces\.organization_id/);
  assert.match(migration, /member\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(service, /permissionCatalog/);
  assert.match(service, /assertTaskChangesAllowed/);
  assert.match(service, /assertLeadChangesAllowed/);
  assert.match(service, /assertConfigurationChangesAllowed/);
  assert.match(route, /z\.record/);
  assert.match(client, /Create custom role/);
  assert.match(client, /Leads & clients/);
  assert.match(client, /Team & security/);
});

test("Vercel authentication attempts use a durable server-only limiter", async () => {
  const migration = await read("migrations/003_security_rate_limits.sql");
  const service = await read("src/services/vercel-request.js");
  const signIn = await read("api/auth/sign-in.js");
  assert.match(migration, /create table if not exists public\.security_rate_limits/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.security_rate_limits from anon, authenticated/);
  assert.match(service, /insert into public\.security_rate_limits/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(signIn, /await rateLimit/);
});
