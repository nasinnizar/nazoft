(() => {
  const menu = document.querySelector('#settings .settings-menu');
  const peopleButton = menu?.querySelector('[data-setting="users"]');
  if (!menu || !peopleButton) return;
  const mayManageAccess = () => hasPermission('Manage permissions') || hasPermission('Manage users');
  const accessButton = document.createElement('button');
  accessButton.type = 'button'; accessButton.dataset.setting = 'access'; accessButton.textContent = 'Roles & permissions';
  accessButton.onclick = () => selectSetting('access'); accessButton.classList.toggle('hidden', !mayManageAccess()); peopleButton.after(accessButton);

  const permissionGroups = [
    ['Pages', ['View dashboard', 'View tasks', 'View leads', 'View pipeline', 'View proposals', 'View content', 'View activities', 'View reports', 'View settings']],
    ['Leads & clients', ['View all leads', 'Create leads', 'Edit leads', 'Delete leads', 'Assign leads', 'Import leads', 'Export leads', 'Manage follow-ups', 'Add private notes', 'Share lead details']],
    ['Tasks', ['Create tasks', 'Edit tasks', 'Complete tasks', 'Delete tasks']],
    ['Pipeline', ['Move pipeline leads', 'Manage pipelines']],
    ['Proposals', ['Create proposals', 'Edit proposals', 'Download proposals']],
    ['Content', ['Create content', 'Edit content', 'Delete content', 'Send content']],
    ['Activities & reports', ['Log activities', 'Edit activities', 'Delete activities', 'Export reports']],
    ['CRM setup', ['Manage fields', 'Manage products', 'Manage client groups', 'Manage lead sources', 'Manage automations', 'Manage notifications', 'Manage forms', 'Manage integrations', 'Manage regional settings', 'Manage branding', 'Edit CRM settings']],
    ['Team & security', ['View team', 'Invite users', 'Edit users', 'Suspend users', 'Remove users', 'Manage permissions', 'Manage users', 'Export data']],
  ];
  const builtInRoles = new Set(['admin', 'manager', 'sales', 'viewer']);
  const title = role => roleAccess[role]?.label || roleLabel(role);
  function permissionGroupMarkup(selected, locked, group, index) {
    const [name, permissions] = group, count = permissions.filter(permission => selected.has(permission) || locked).length;
    return `<details class="role-permission-group" ${index === 0 ? 'open' : ''}><summary><span>${safe(name)}</span><small>${count}/${permissions.length}</small></summary><div>${permissions.map(permission => `<label><input type="checkbox" value="${safe(permission)}" ${selected.has(permission) || locked ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${safe(permission)}</span></label>`).join('')}</div></details>`;
  }
  function roleCard(role) {
    const locked = role === 'admin', selected = new Set(roleAccess[role]?.permissions || []);
    return `<section class="role-access-card" data-role-card="${safe(role)}"><div class="role-access-heading"><div><h3>${safe(title(role))}</h3><p>${locked ? 'Full organization control. This role cannot be limited.' : 'Choose exactly what people with this role can see and change.'}</p></div><div class="role-heading-actions">${locked ? '<span class="role-badge">Protected</span>' : !builtInRoles.has(role) ? `<button class="btn small danger" type="button" data-delete-role="${safe(role)}">Delete role</button>` : ''}</div></div><div class="role-permission-list">${permissionGroups.map((group, index) => permissionGroupMarkup(selected, locked, group, index)).join('')}</div></section>`;
  }
  function accessMarkup() {
    return `<div class="settings-title-row"><div><h2>Roles & permissions</h2><p class="muted">Control every CRM area and action. Create custom roles for the way your team works.</p></div><div class="settings-title-actions"><button class="btn" type="button" id="inviteCustomUser">＋ Invite user</button><button class="btn" type="button" id="addCustomRole">＋ Create custom role</button></div></div><form id="roleAccessForm"><div class="role-access-grid">${Object.keys(roleAccess).map(roleCard).join('')}</div><div class="actions-end sticky-role-save"><button class="btn primary" type="submit">Save permissions</button></div></form>`;
  }

  const settingsHtmlBase = settingsHtml;
  settingsHtml = function (name) {
    if (name === 'access') return mayManageAccess() ? accessMarkup() : '<div class="empty-state"><h2>Administrator access required</h2><p class="muted">Only authorized administrators can change roles and permissions.</p></div>';
    const html = settingsHtmlBase(name); if (name !== 'users') return html;
    const used = Number(organizationUserInfo.seatUsage) || users.length, limit = Number(organizationUserInfo.seatLimit) || 5;
    const plan = safe(String(organizationUserInfo.plan || 'starter').replace(/^./, character => character.toUpperCase()));
    return html.replace('</div>', `</div><div class="team-plan-summary"><div><small>${plan} plan</small><b>${used} of ${limit} team seats used</b></div><div class="seat-meter"><i style="width:${Math.min(100, used / limit * 100)}%"></i></div></div>`).replace('data-config-add="user"', `data-config-add="user" ${used >= limit ? 'disabled title="Plan seat limit reached"' : ''}`);
  };

  function bindAccessForm() {
    const form = document.querySelector('#roleAccessForm'); if (!form) return;
    document.querySelector('#inviteCustomUser').onclick = () => openConfig('user');
    document.querySelector('#addCustomRole').onclick = () => {
      const name = prompt('Name this custom role'); if (!name?.trim()) return;
      const role = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
      if (!/^[a-z][a-z0-9_-]{1,31}$/.test(role)) return toast('Use at least two letters or numbers for the role name');
      if (roleAccess[role]) return toast('A role with this name already exists');
      roleAccess[role] = { label: name.trim().slice(0, 40), permissions: [] }; organizationUserInfo.rolePermissions[role] = [];
      renderConfigSetting('access'); document.querySelector(`[data-role-card="${role}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    form.querySelectorAll('[data-delete-role]').forEach(button => button.onclick = () => {
      const role = button.dataset.deleteRole;
      if (users.some(user => user.role === title(role))) return toast('Reassign users from this role before deleting it');
      if (!confirm(`Delete the ${title(role)} role?`)) return;
      delete roleAccess[role]; delete organizationUserInfo.rolePermissions[role]; renderConfigSetting('access');
    });
    form.onsubmit = async event => {
      event.preventDefault(); const button = form.querySelector('[type="submit"]'), rolePermissions = {};
      form.querySelectorAll('[data-role-card]').forEach(card => { const role = card.dataset.roleCard; if (role !== 'admin') rolePermissions[role] = [...card.querySelectorAll('input:checked')].map(input => input.value); });
      setAuthLoading(button, true);
      try {
        const response = await fetch('/api/users', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rolePermissions }) });
        const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Unable to save role permissions');
        Object.keys(roleAccess).filter(role => !builtInRoles.has(role) && !Object.hasOwn(result.rolePermissions, role)).forEach(role => delete roleAccess[role]);
        syncRoleAccess(result.rolePermissions); organizationUserInfo.rolePermissions = result.rolePermissions;
        users = users.map(user => { const key = Object.keys(roleAccess).find(role => roleAccess[role].label === user.role) || 'viewer'; return { ...user, permissions: roleAccess[key].permissions }; });
        applyAccess(); toast('Roles and permissions saved'); renderConfigSetting('access');
      } catch (error) { toast(error.message); } finally { setAuthLoading(button, false); }
    };
  }
  const renderConfigSettingBase = renderConfigSetting;
  renderConfigSetting = function (name = currentSetting) { renderConfigSettingBase(name); if (name === 'access') bindAccessForm(); };
  const selectSettingBase = selectSetting;
  selectSetting = function (name) { selectSettingBase(name); if (name === 'access') loadOrganizationUsers(); };

  const style = document.createElement('style');
  style.textContent = `.settings-title-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto}.settings-title-actions .btn{min-width:max-content;white-space:nowrap}.team-plan-summary{display:grid;grid-template-columns:auto minmax(120px,220px);align-items:center;gap:16px;margin:14px 0 6px;padding:13px 15px;border:1px solid var(--line);border-radius:12px;background:var(--blue2)}.team-plan-summary div:first-child{display:grid;gap:2px}.team-plan-summary small{color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:760}.seat-meter{height:7px;border-radius:99px;background:color-mix(in srgb,var(--line) 80%,transparent);overflow:hidden}.seat-meter i{display:block;height:100%;border-radius:inherit;background:var(--blue)}.role-access-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.role-access-card{border:1px solid var(--line);border-radius:14px;padding:16px;background:var(--white);min-width:0}.role-access-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--line)}.role-access-heading h3,.role-access-heading p{margin:0}.role-access-heading p{margin-top:4px;color:var(--muted);font-size:12px}.role-heading-actions{display:flex;align-items:center;gap:7px}.role-permission-list{display:grid;gap:6px;padding-top:10px}.role-permission-group{border:1px solid var(--line);border-radius:10px;overflow:hidden}.role-permission-group summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 11px;cursor:pointer;font-weight:760;list-style:none}.role-permission-group summary::-webkit-details-marker{display:none}.role-permission-group summary:hover{background:var(--blue2)}.role-permission-group summary small{color:var(--muted)}.role-permission-group>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:4px 7px 8px;border-top:1px solid var(--line)}.role-permission-group label{display:flex;align-items:center;gap:8px;min-height:35px;padding:5px 6px;border-radius:8px;cursor:pointer;font-size:12px}.role-permission-group label:hover{background:var(--blue2)}.role-permission-group input{width:16px;height:16px;accent-color:var(--blue);flex:0 0 auto}.sticky-role-save{position:sticky;bottom:10px;padding:10px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--white) 92%,transparent);backdrop-filter:blur(10px);z-index:2}@media(max-width:760px){.settings-title-actions{width:100%;justify-content:flex-start;flex-wrap:wrap}.role-access-grid{grid-template-columns:1fr}.team-plan-summary{grid-template-columns:1fr}.role-permission-group>div{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
})();
