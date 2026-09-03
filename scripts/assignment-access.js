(() => {
  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const userIsActive = user => String(user?.status || 'active').toLowerCase() !== 'suspended';
  const userIdentity = user => normalizeEmail(user?.email) || String(user?.name || '').trim().toLowerCase();
  const ownerIdentity = lead => normalizeEmail(lead?.ownerEmail) || String(lead?.owner || '').trim().toLowerCase();

  function leadVisibleToCurrentUser(lead) {
    let viewer = currentUser();
    return Boolean(lead && userIdentity(viewer) && ownerIdentity(lead) === userIdentity(viewer));
  }

  function assignedLeadsFor(user) {
    let identity = userIdentity(user);
    return leads.filter(lead => ownerIdentity(lead) === identity);
  }

  function visibleFeed() {
    let visibleNames = new Set(leads.filter(leadVisibleToCurrentUser).map(lead => String(lead.name || '').toLowerCase()));
    return feed.filter(item => visibleNames.has(String(item?.[1] || '').toLowerCase()));
  }

  function withAssignedWorkspace(render) {
    let workspaceLeads = leads, workspaceFeed = feed;
    leads = workspaceLeads.filter(leadVisibleToCurrentUser);
    feed = visibleFeed();
    try { return render(); }
    finally { leads = workspaceLeads; feed = workspaceFeed; }
  }

  /* One counter is shared by the workspace, regardless of who owns each lead. */
  let recordCounters = {};
  try {
    let source = window.__NAZOFT_AUTHENTICATED__ ? window.__NAZOFT_REMOTE_STATE__ : null;
    if (source?.recordCounters && typeof source.recordCounters === 'object') recordCounters = structuredClone(source.recordCounters);
  } catch (error) {}

  const currentWorkspaceStateAssignmentBase = currentWorkspaceState;
  currentWorkspaceState = function () {
    return { ...currentWorkspaceStateAssignmentBase(), recordCounters };
  };

  nextRecordNumber = function (_prefix, key) {
    let settings = recordNumberSettings(), type = key === 'proposalNumber' ? 'proposal' : 'lead';
    let existingMax = [...leads, ...deletedLeads].reduce((highest, lead) => {
      let match = String(lead?.[key] || '').match(/(\d+)$/);
      return Math.max(highest, match ? Number(match[1]) : 0);
    }, 0);
    let saved = recordCounters[key], savedMax = Number(saved?.value) || 0;
    let start = Number(type === 'proposal' ? settings.proposalStart : settings.leadStart) || 1;
    let value = Math.max(existingMax, savedMax, start - 1) + 1;
    recordCounters[key] = { year: new Date().getFullYear(), value };
    return formatRecordNumber(type, value, settings);
  };

  function lockLeadOwnerControls() {
    let viewer = currentUser(), ownerFilter = $('#leadOwnerFilter');
    if (ownerFilter) {
      ownerFilter.value = viewer.email || '';
      ownerFilter.classList.add('hidden');
      let enhanced = ownerFilter.nextElementSibling;
      if (enhanced?.classList.contains('select-ui')) enhanced.classList.add('hidden');
    }
    let ownerSelect = $('#leadForm [name="owner"]');
    if (ownerSelect && !hasPermission('Manage users')) {
      ownerSelect.value = viewer.email || '';
      ownerSelect.setAttribute('aria-disabled', 'true');
      ownerSelect.tabIndex = -1;
      let enhanced = ownerSelect.nextElementSibling;
      if (enhanced?.classList.contains('select-ui')) {
        enhanced.classList.add('assignment-locked');
        enhanced.setAttribute('aria-disabled', 'true');
      }
    }
  }

  const applyAccessAssignmentBase = applyAccess;
  applyAccess = function () {
    applyAccessAssignmentBase();
    lockLeadOwnerControls();
  };

  const renderLeadsAssignmentBase = renderLeads;
  renderLeads = function (query = '') {
    let ownerFilter = $('#leadOwnerFilter');
    if (ownerFilter) ownerFilter.value = currentUser().email || '';
    renderLeadsAssignmentBase(query);
    let visible = [];
    $$('#leadRows tr[data-index]').forEach(row => {
      let index = Number(row.dataset.index);
      if (!leadVisibleToCurrentUser(leads[index])) row.remove();
      else visible.push(index);
    });
    lastVisible = visible;
    if (!visible.length) $('#leadRows').innerHTML = '<tr><td colspan="9" class="assigned-empty">No leads are assigned to you.</td></tr>';
    selected = new Set([...selected].filter(index => visible.includes(index)));
    updateBulk();
    lockLeadOwnerControls();
  };

  const renderBoardAssignmentBase = renderBoard;
  renderBoard = function (query = '') {
    renderBoardAssignmentBase(query);
    $$('#board .deal[data-index]').forEach(card => {
      if (!leadVisibleToCurrentUser(leads[Number(card.dataset.index)])) card.remove();
    });
    $$('#board .column').forEach(column => {
      let count = column.querySelector('.count');
      if (count) count.textContent = String(column.querySelectorAll('.deal[data-index]').length);
    });
  };

  const renderTodayAssignmentBase = renderToday;
  renderToday = function () {
    withAssignedWorkspace(() => renderTodayAssignmentBase());
    let activityMetric = $$('#today .dashboard-metric').find(card => card.querySelector('label')?.textContent.trim() === 'Activities today');
    if (activityMetric) {
      let total = visibleFeed().length;
      activityMetric.querySelector('strong').textContent = String(total);
      let detail = activityMetric.querySelector('em');
      if (detail) detail.textContent = total ? 'Your assigned lead activity' : 'No activity yet';
    }
    applyAccess();
  };

  const renderActivitiesAssignmentBase = renderActivities;
  renderActivities = function () {
    let workspaceFeed = feed;
    feed = visibleFeed();
    try { renderActivitiesAssignmentBase(); }
    finally { feed = workspaceFeed; }
  };

  const renderSalesAssignmentBase = renderSalesPerformance;
  renderSalesPerformance = function () {
    return withAssignedWorkspace(() => renderSalesAssignmentBase());
  };

  const renderUserPerformanceAssignmentBase = renderUserPerformance;
  renderUserPerformance = function (period = 'week') {
    return withAssignedWorkspace(() => renderUserPerformanceAssignmentBase(period));
  };

  const openLeadAssignmentGuardBase = openLead;
  openLead = function (index) {
    if (!leadVisibleToCurrentUser(leads[index])) {
      closeLeadDrawer?.();
      return toast('This lead is assigned to another user');
    }
    return openLeadAssignmentGuardBase(index);
  };

  const openContactAssignmentGuardBase = openContact;
  openContact = function (channel, name) {
    let candidate = leads.find(lead => lead.name === name && leadVisibleToCurrentUser(lead)) || leads[currentLead];
    if (!leadVisibleToCurrentUser(candidate)) return toast('This lead is assigned to another user');
    currentLead = leads.indexOf(candidate);
    return openContactAssignmentGuardBase(channel, candidate.name);
  };

  const buildSmartResultsAssignmentBase = buildSmartResults;
  buildSmartResults = function (query) {
    let names = new Set(leads.filter(leadVisibleToCurrentUser).map(lead => String(lead.name || '').toLowerCase()));
    return buildSmartResultsAssignmentBase(query).filter(result => {
      if (result.type === 'lead') return leadVisibleToCurrentUser(leads[result.index]);
      if (result.type === 'activity') return names.has(String(feed[result.index]?.[1] || '').toLowerCase());
      return true;
    });
  };

  const exportDataAssignmentBase = exportData;
  exportData = function () {
    return withAssignedWorkspace(() => exportDataAssignmentBase());
  };

  function decorateUserReassignment() {
    $$('#settingsPane .user-row').forEach((row, index) => {
      let user = users[index], actions = row.querySelector('.settings-actions');
      if (!user || !actions || actions.querySelector('[data-reassign-user]')) return;
      let count = assignedLeadsFor(user).filter(lead => !lead.archived).length;
      actions.insertAdjacentHTML('afterbegin', `<button class="btn small soft" type="button" data-reassign-user="${index}">${uiIcon('users')}<span>Reassign leads${count ? ` (${count})` : ''}</span></button>`);
    });
  }

  const handleSettingAssignmentBase = handleSettingClick;
  handleSettingClick = function (event) {
    let button = event.target.closest('[data-reassign-user]');
    if (button) {
      event.preventDefault(); event.stopPropagation();
      return openConfig('reassign', Number(button.dataset.reassignUser));
    }
    return handleSettingAssignmentBase(event);
  };

  const renderConfigAssignmentBase = renderConfigSetting;
  renderConfigSetting = function (name = currentSetting) {
    renderConfigAssignmentBase(name);
    if (name === 'users') {
      $('#settingsPane').onclick = handleSettingClick;
      decorateUserReassignment();
      enhanceIconography($('#settingsPane'));
    }
  };
  new MutationObserver(() => {
    if ($('#settingsPane .user-row')) decorateUserReassignment();
  }).observe($('#settingsPane'), { childList: true, subtree: true });

  const openConfigAssignmentBase = openConfig;
  openConfig = function (entity, index = -1) {
    if (entity !== 'reassign') return openConfigAssignmentBase(entity, index);
    let source = users[index], destinations = users.filter((user, userIndex) => userIndex !== index && userIsActive(user) && user.email);
    if (!source) return toast('Choose a valid user');
    if (!destinations.length) return toast('Add another active user before reassigning leads');
    let count = assignedLeadsFor(source).filter(lead => !lead.archived).length, form = $('#configForm');
    form.reset();
    form.elements.entity.value = 'reassign';
    form.elements.index.value = String(index);
    $('#configTitle').textContent = `Reassign ${source.name}’s leads`;
    $('#configFields').innerHTML = `<div class="field full"><div class="reassign-summary"><span class="activity-icon">${uiIcon('users')}</span><div><b>${count} active ${count === 1 ? 'lead' : 'leads'}</b><small>All leads currently assigned to ${safe(source.name)} will move together.</small></div></div></div><div class="field full"><label>Reassign to</label><select name="targetEmail" required>${destinations.map(user => `<option value="${safe(user.email)}">${safe(user.name)} · ${safe(user.role || 'Team member')}</option>`).join('')}</select></div><div class="field full"><div class="import-hint">Lead numbers, follow-ups, notes, pipeline stages, and client timelines will stay unchanged.</div></div>`;
    let submit = form.querySelector('[type="submit"]');
    submit.textContent = 'Reassign leads';
    $('#configModal').classList.add('open');
    upgradeSelects($('#configFields'));
    enhanceIconography(form);
  };

  async function commitLeadReassignment(source, target) {
    let affected = assignedLeadsFor(source);
    if (!affected.length) return 0;
    if (window.__NAZOFT_AUTHENTICATED__ && source.id && target.id) {
      await userApi('PATCH', { action: 'reassign-leads', fromUserId: source.id, toUserId: target.id });
    }
    let actor = currentUser();
    affected.forEach(lead => {
      lead.owner = target.name;
      lead.ownerEmail = target.email;
      lead.assignedBy = actor.name || actor.email;
      addTimeline(lead, 'Lead reassigned', `${source.name} → ${target.name}`);
      feed.unshift(['Lead reassigned', lead.name, `${source.name} → ${target.name}`, 'Just now', actor.email || actor.name]);
    });
    saveState();
    return affected.length;
  }

  const configSubmitAssignmentBase = $('#configForm').onsubmit;
  $('#configForm').onsubmit = async event => {
    let form = event.target;
    if (form.elements.entity.value !== 'reassign') return configSubmitAssignmentBase(event);
    event.preventDefault();
    let source = users[Number(form.elements.index.value)], target = users.find(user => normalizeEmail(user.email) === normalizeEmail(form.elements.targetEmail.value));
    if (!source || !target) return toast('Choose the user who should receive these leads');
    let submit = form.querySelector('[type="submit"]');
    setAuthLoading?.(submit, true);
    try {
      let count = await commitLeadReassignment(source, target);
      $('#configModal').classList.remove('open');
      renderConfigSetting('users'); renderLeads($('#leadSearch').value); renderBoard($('#boardSearch').value); renderToday(); renderActivities(); renderSalesPerformance();
      toast(count ? `${count} ${count === 1 ? 'lead' : 'leads'} reassigned to ${target.name}` : `${source.name} has no leads to reassign`);
    } catch (error) { toast(error.message || 'Unable to reassign these leads'); }
    finally { setAuthLoading?.(submit, false); }
  };

  saveState();
  syncConfigOptions();
  renderLeads($('#leadSearch').value);
  renderBoard($('#boardSearch').value);
  renderActivities();
  renderToday();
  renderSalesPerformance();
  if (currentSetting === 'users') renderConfigSetting('users');
})();
