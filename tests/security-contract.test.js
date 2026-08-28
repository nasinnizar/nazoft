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

test("won deals require a positive closed value before creating a client", async () => {
  const html = await read("index.html");
  assert.match(html, /id="wonConfirmForm"/);
  assert.match(html, /id="wonConfirmValue"[^>]*min="0\.01"[^>]*required/);
  assert.match(html, /stageName==='Won'.*requestWonDetails/);
  assert.match(html, /if\(!Number\.isFinite\(amount\)\|\|amount<=0\)/);
  assert.match(html, /lead\.closedValue=.*commitPipelineStage/);
  assert.match(html, /commitPipelineStage.*finalizeWonLead/s);
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
  assert.match(html, /professional-ui\.css\?v=15/);
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
  assert.match(html, /professional-ui\.css\?v=15/);
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
