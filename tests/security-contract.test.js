import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("login failures remain visible and accessible", async () => {
  const html = await read("index.html");
  assert.match(html, /id="loginError" role="alert" aria-live="polite"/);
  assert.match(html, /Invalid email or password|error\.message/);
  assert.match(html, /aria-invalid/);
});

test("successful authentication never flashes the sign-in form again", async () => {
  const html = await read("index.html");
  assert.match(html, /function showAuthTransition/);
  assert.match(html, /await authApi\('\/api\/auth\/sign-in'.*navigating=true;showAuthTransition\(\);location\.reload\(\)/s);
  assert.match(html, /finally\{if\(!navigating\)setAuthLoading\(button,false\)\}/);
  assert.match(html, /initialLoader\?\.classList\.add\('is-ready'\)/);
  assert.doesNotMatch(html, /1150/);
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

test("lead temperature is opt-in and timeline entries use durable timestamps", async () => {
  const html = await read("index.html");
  const importExport = await read("scripts/import-export.js");
  assert.match(html, /if\(l\.temperature===undefined\|\|l\.temperature===null\)l\.temperature=''/);
  assert.match(html, /status:'Uncontacted',temperature:'',score:null/);
  assert.match(html, /temperature=\(\{Hot:18,Warm:9,Cold:0\}\[leadTemperature\(l\)\]\?\?0\)/);
  assert.match(importExport, /Choose temperature/);
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
  assert.match(html, /mobile-sidebar\.js\?v=1/);
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
    assert.ok(source.indexOf("await requireOrganizationAdmin") < source.indexOf("inviteUserByEmail"));
  }
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
