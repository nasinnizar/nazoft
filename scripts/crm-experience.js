(() => {
  const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
  const timeZones = ['Asia/Riyadh', 'Asia/Dubai', 'Asia/Bahrain', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Muscat', 'Europe/London', 'America/New_York', 'UTC'];

  accountPreferences.notifications = {
    ...accountPreferences.notifications,
    browserEnabled: accountPreferences.notifications.browserEnabled !== false,
    assignedLead: accountPreferences.notifications.assignedLead !== false,
    newLeadBrowser: accountPreferences.notifications.newLeadBrowser ?? accountPreferences.notifications.newLeadEmail ?? true,
    timezoneMode: accountPreferences.notifications.timezoneMode || 'auto',
    timezone: accountPreferences.notifications.timezone || detectedTimeZone,
    inbox: Array.isArray(accountPreferences.notifications.inbox) ? accountPreferences.notifications.inbox : [],
    lastSummaryDate: accountPreferences.notifications.lastSummaryDate || ''
  };
  accountPreferences.workHours = {
    start: '09:00',
    end: '17:00',
    idleMinutes: 5,
    ...(accountPreferences.workHours || {})
  };
  saveAccountPreferences();

  iconDrawings.bell = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>';
  iconDrawings.briefcase = '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>';

  function effectiveTimeZone() {
    return accountPreferences.notifications.timezoneMode === 'manual'
      ? accountPreferences.notifications.timezone
      : detectedTimeZone;
  }

  function zonedParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: effectiveTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
  }

  function browserPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  function notificationIcon(kind) {
    if (kind === 'followup') return 'clock';
    if (kind === 'assignment' || kind === 'lead') return 'users';
    if (kind === 'summary') return 'activity';
    return 'bell';
  }

  function notificationInbox() {
    return accountPreferences.notifications.inbox;
  }

  let notificationButton = document.createElement('button');
  notificationButton.type = 'button';
  notificationButton.id = 'notificationButton';
  notificationButton.className = 'btn notification-button';
  notificationButton.setAttribute('aria-label', 'Open notifications');
  notificationButton.setAttribute('aria-expanded', 'false');
  notificationButton.innerHTML = uiIcon('bell');
  let notificationPopover = document.createElement('section');
  notificationPopover.id = 'notificationPopover';
  notificationPopover.className = 'notification-popover hidden';
  notificationPopover.setAttribute('aria-label', 'Notifications');
  document.body.appendChild(notificationPopover);
  $('.top-actions')?.insertAdjacentElement('beforebegin', notificationButton);

  function positionNotificationPopover() {
    let rect = notificationButton.getBoundingClientRect(), width = Math.min(370, innerWidth - 24);
    notificationPopover.style.width = `${width}px`;
    notificationPopover.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, rect.right - width))}px`;
    notificationPopover.style.top = `${rect.bottom + 9}px`;
  }

  function renderNotificationCenter() {
    let items = notificationInbox(), unread = items.filter(item => item.unread).length;
    notificationButton.querySelector('.notification-badge')?.remove();
    if (unread) notificationButton.insertAdjacentHTML('beforeend', `<span class="notification-badge">${Math.min(unread, 99)}</span>`);
    notificationPopover.innerHTML = `<div class="notification-popover-head"><h3>Notifications</h3>${unread ? '<button type="button" data-notification-read>Mark all read</button>' : ''}</div>${items.length ? items.slice(0, 30).map(item => `<button type="button" class="notification-item ${item.unread ? 'unread' : ''}" data-notification-id="${safe(item.id)}"><span class="notification-item-icon">${uiIcon(notificationIcon(item.kind))}</span><span><b>${safe(item.title)}</b><small>${safe(item.body)}</small><small>${safe(item.when || 'Just now')}</small></span></button>`).join('') : '<div class="notification-empty">You are all caught up.</div>'}`;
  }

  function openNotificationTarget(item) {
    if (item.leadNumber) {
      let index = leads.findIndex(lead => ensureLeadNumber(lead) === item.leadNumber || lead.clientNumber === item.leadNumber);
      if (index >= 0) { page('leads'); renderLeads($('#leadSearch').value); openLead(index); }
    } else if (item.kind === 'summary') page('today');
  }

  function pushCrmNotification(title, body, kind = 'activity', lead = null, options = {}) {
    let item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title, body, kind, unread: true, when: 'Just now',
      createdAt: Date.now(), leadNumber: lead ? ensureLeadNumber(lead) : ''
    };
    notificationInbox().unshift(item);
    accountPreferences.notifications.inbox = notificationInbox().slice(0, 50);
    saveAccountPreferences();
    renderNotificationCenter();
    if (options.browser !== false && accountPreferences.notifications.browserEnabled && browserPermission() === 'granted') {
      try {
        let notice = new Notification(title, { body, tag: options.tag || `nazoft-${kind}-${item.leadNumber || item.id}` });
        notice.onclick = () => { window.focus(); openNotificationTarget(item); notice.close(); };
      } catch (error) {}
    }
    return item;
  }

  notificationButton.onclick = event => {
    event.stopPropagation();
    let opening = notificationPopover.classList.contains('hidden');
    notificationPopover.classList.toggle('hidden', !opening);
    notificationButton.setAttribute('aria-expanded', String(opening));
    if (opening) { positionNotificationPopover(); renderNotificationCenter(); }
  };
  notificationPopover.onclick = event => {
    event.stopPropagation();
    if (event.target.closest('[data-notification-read]')) {
      notificationInbox().forEach(item => item.unread = false);
      saveAccountPreferences(); renderNotificationCenter(); return;
    }
    let button = event.target.closest('[data-notification-id]');
    if (!button) return;
    let item = notificationInbox().find(entry => entry.id === button.dataset.notificationId);
    if (!item) return;
    item.unread = false; saveAccountPreferences(); renderNotificationCenter(); openNotificationTarget(item);
    notificationPopover.classList.add('hidden'); notificationButton.setAttribute('aria-expanded', 'false');
  };
  document.addEventListener('click', () => { notificationPopover.classList.add('hidden'); notificationButton.setAttribute('aria-expanded', 'false'); });
  addEventListener('resize', () => { if (!notificationPopover.classList.contains('hidden')) positionNotificationPopover(); });
  renderNotificationCenter();

  const settingsHtmlExperienceBase = settingsHtml;
  settingsHtml = function (name) {
    if (name === 'notifications') {
      let permission = browserPermission(), permissionLabel = permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : permission === 'unsupported' ? 'Unavailable' : 'Not enabled';
      let zone = effectiveTimeZone(), manual = accountPreferences.notifications.timezoneMode === 'manual';
      return `<h2>Notifications</h2><p class="muted">Receive important lead and follow-up alerts in Nazoft CRM and, when allowed, through your browser.</p><div class="permission-card"><span class="notification-item-icon">${uiIcon('bell')}</span><div class="grow"><b>Browser notifications</b><small>${permission === 'denied' ? 'Permission is blocked. Allow notifications for this site in your browser settings.' : 'Enable once and this browser can alert you while Nazoft CRM is open.'}</small></div><span class="permission-state ${permission === 'granted' ? 'granted' : ''}">${safe(permissionLabel)}</span>${permission === 'default' ? '<button class="btn primary" type="button" data-enable-browser-notifications>Enable</button>' : ''}<button class="btn" type="button" data-test-notification ${permission !== 'granted' ? 'disabled' : ''}>Test</button></div><section class="preference-section"><h3>Lead alerts</h3><p class="muted">These alerts are delivered to the assigned employee.</p>${prefSwitch('notifications.newLeadBrowser', 'New lead received')}${prefSwitch('notifications.assignedLead', 'Lead assigned to me')}</section><section class="preference-section"><h3>Daily CRM summary</h3><p class="muted">A browser and CRM-inbox summary while the CRM is open. Email delivery requires a connected mail provider.</p>${prefChoices('notifications.summaryMode', [['always', 'Always send'], ['updates', 'Only when there are updates'], ['never', 'Never send']])}<div class="preference-row"><div class="grow"><b>Summary delivery time</b><small>Currently uses ${safe(zone)}</small></div><input type="time" data-pref="notifications.summaryTime" value="${safe(accountPreferences.notifications.summaryTime)}"></div><div class="preference-row timezone-row"><div class="grow"><b>Time zone</b><small>Automatic uses this device. Choose manual for distributed teams.</small></div><div class="timezone-controls">${prefChoices('notifications.timezoneMode', [['auto', `Automatic · ${detectedTimeZone}`], ['manual', 'Choose manually']], false)}${manual ? `<select data-pref="notifications.timezone">${[...new Set([accountPreferences.notifications.timezone, ...timeZones])].map(value => `<option ${value === accountPreferences.notifications.timezone ? 'selected' : ''}>${safe(value)}</option>`).join('')}</select>` : ''}</div></div></section><section class="preference-section"><h3>Activity alerts</h3>${prefSwitch('notifications.followupDue', 'Follow-up due')}${prefSwitch('notifications.followupOverdue', 'Follow-up overdue')}${prefSwitch('notifications.contentViewed', 'Client viewed content')}</section><div class="preference-actions"><button class="btn primary" data-pref-save>Save notification settings</button></div>`;
    }
    if (name === 'workHours') return workHoursHtml();
    return settingsHtmlExperienceBase(name);
  };

  let workHoursMenu = document.createElement('button');
  workHoursMenu.dataset.setting = 'workHours';
  workHoursMenu.textContent = 'Team work hours';
  $('[data-setting="users"]')?.insertAdjacentElement('afterend', workHoursMenu);
  workHoursMenu.onclick = () => selectSetting('workHours');

  let workUsage = [];
  try {
    let source = window.__NAZOFT_REMOTE_STATE__ || JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(source?.workUsage)) workUsage = source.workUsage;
  } catch (error) {}
  const currentWorkspaceStateExperienceBase = currentWorkspaceState;
  currentWorkspaceState = function () { return { ...currentWorkspaceStateExperienceBase(), workUsage }; };

  function minutesFromTime(value) { let [hour, minute] = String(value || '00:00').split(':').map(Number); return (hour || 0) * 60 + (minute || 0); }
  function scheduledMinutes() { return Math.max(1, minutesFromTime(accountPreferences.workHours.end) - minutesFromTime(accountPreferences.workHours.start)); }
  function formatDuration(seconds) { let minutes = Math.max(0, Math.round(Number(seconds || 0) / 60)); return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`; }
  function todayUsage(email) { let key = zonedParts().date; return workUsage.find(item => item.date === key && item.email?.toLowerCase() === String(email || '').toLowerCase()); }
  function workHoursHtml() {
    let visibleUsers = hasPermission('Manage users') ? users : [currentUser()], shiftMinutes = scheduledMinutes();
    return `<h2>Team work hours</h2><p class="muted">Active CRM time is counted while the page is visible and the employee has interacted within the last ${safe(accountPreferences.workHours.idleMinutes)} minutes. It is an operational usage indicator, not a payroll clock.</p><div class="preference-intro"><span class="activity-icon">${uiIcon('briefcase')}</span><div><b>Today · ${safe(effectiveTimeZone())}</b><div>Compare active CRM time with the normal company workday.</div></div></div><section class="preference-section"><h3>Normal workday</h3><div class="preference-row"><div class="grow"><b>Start and end</b><small>Used for progress and in-hours reporting.</small></div><div class="row-actions"><input type="time" data-work-start value="${safe(accountPreferences.workHours.start)}"><input type="time" data-work-end value="${safe(accountPreferences.workHours.end)}"></div></div></section><div class="work-hours-grid">${visibleUsers.map(user => { let usage = todayUsage(user.email), seconds = usage?.seconds || 0, inHours = usage?.scheduledSeconds || 0, progress = Math.min(100, Math.round(seconds / (shiftMinutes * 60) * 100)); return `<article class="work-hour-card"><small>${safe(user.role || 'Team member')}</small><b>${safe(user.name || user.email)}</b><strong>${formatDuration(seconds)}</strong><span class="muted">${formatDuration(inHours)} during ${safe(accountPreferences.workHours.start)}–${safe(accountPreferences.workHours.end)}</span><div class="work-hour-bar"><i style="width:${progress}%"></i></div><small>${progress}% of the scheduled workday · last active ${safe(usage?.lastSeen ? new Date(usage.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'not today')}</small></article>`; }).join('')}</div><div class="preference-actions"><button class="btn primary" type="button" data-refresh-work-hours>Refresh usage</button></div>`;
  }

  const renderConfigExperienceBase = renderConfigSetting;
  renderConfigSetting = function (name = currentSetting) {
    renderConfigExperienceBase(name);
    let pane = $('#settingsPane');
    if (name === 'notifications') {
      pane.querySelector('[data-enable-browser-notifications]')?.addEventListener('click', async event => {
        event.stopPropagation();
        try { await Notification.requestPermission(); } catch (error) {}
        renderConfigSetting('notifications');
      });
      pane.querySelector('[data-test-notification]')?.addEventListener('click', event => {
        event.stopPropagation(); pushCrmNotification('Nazoft CRM notifications are working', 'You will receive assigned-lead and follow-up alerts here.', 'activity');
      });
      pane.addEventListener('change', event => {
        if (event.target.dataset.pref === 'notifications.timezoneMode') queueMicrotask(() => renderConfigSetting('notifications'));
      });
      upgradeSelects(pane); enhanceIconography(pane);
    }
    if (name === 'workHours') {
      pane.querySelector('[data-work-start]')?.addEventListener('change', event => { accountPreferences.workHours.start = event.target.value; saveAccountPreferences(); renderConfigSetting('workHours'); });
      pane.querySelector('[data-work-end]')?.addEventListener('change', event => { accountPreferences.workHours.end = event.target.value; saveAccountPreferences(); renderConfigSetting('workHours'); });
      pane.querySelector('[data-refresh-work-hours]')?.addEventListener('click', () => { recordUsageTick(true); renderConfigSetting('workHours'); toast('Work hours refreshed'); });
    }
  };

  showFollowUpNotification = function (lead) {
    let overdue = new Date(lead.followAt).getTime() < Date.now() - 60000;
    if (overdue && !accountPreferences.notifications.followupOverdue) return;
    if (!overdue && !accountPreferences.notifications.followupDue) return;
    let title = `${overdue ? 'Follow-up overdue' : 'Follow-up due'} · ${lead.name}`;
    let body = `${lead.product || 'Lead follow-up'} · ${preciseFollowLabel(lead.followAt)}`;
    pushCrmNotification(title, body, 'followup', lead, { tag: `nazoft-follow-${followUpKey(lead)}` });
    toast(title); renderToday();
  };

  $('#leadForm').addEventListener('submit', event => {
    let isNew = event.target.elements.index.value === '';
    if (!isNew) return;
    queueMicrotask(() => {
      let lead = leads[0], user = currentUser();
      if (!lead || !accountPreferences.notifications.newLeadBrowser) return;
      let assignedHere = !lead.ownerEmail || lead.ownerEmail.toLowerCase() === user.email.toLowerCase();
      if (assignedHere && accountPreferences.notifications.assignedLead) pushCrmNotification(`Lead assigned · ${lead.name}`, `${lead.source || 'New lead'} · ${lead.product || 'Product not selected'}`, 'assignment', lead);
    });
  });

  function dailySummaryCheck() {
    let prefs = accountPreferences.notifications;
    if (prefs.summaryMode === 'never') return;
    let parts = zonedParts(), [targetHour, targetMinute] = String(prefs.summaryTime || '15:00').split(':').map(Number);
    if (parts.hour !== targetHour || parts.minute !== targetMinute || prefs.lastSummaryDate === parts.date) return;
    let assigned = leads.filter(lead => !lead.archived && (!lead.ownerEmail || lead.ownerEmail.toLowerCase() === currentUser().email.toLowerCase())), due = assigned.filter(lead => lead.followAt && new Date(lead.followAt).getTime() <= Date.now() + 86400000).length;
    if (prefs.summaryMode === 'updates' && !feed.length && !due) return;
    prefs.lastSummaryDate = parts.date; saveAccountPreferences();
    pushCrmNotification('Daily CRM summary', `${assigned.length} assigned leads · ${due} follow-ups due within 24 hours`, 'summary');
  }
  setInterval(dailySummaryCheck, 60000);

  let lastUsageTick = Date.now(), lastInteraction = Date.now();
  ['pointerdown', 'keydown', 'touchstart'].forEach(type => document.addEventListener(type, () => { lastInteraction = Date.now(); }, { passive: true }));
  function recordUsageTick(force = false) {
    let now = Date.now(), delta = Math.min(60000, Math.max(0, now - lastUsageTick));
    lastUsageTick = now;
    if (!force && (document.hidden || now - lastInteraction > Number(accountPreferences.workHours.idleMinutes || 5) * 60000)) return;
    let user = currentUser(); if (!user?.email) return;
    let parts = zonedParts(), item = workUsage.find(entry => entry.date === parts.date && entry.email?.toLowerCase() === user.email.toLowerCase());
    if (!item) { item = { date: parts.date, email: user.email, name: user.name, seconds: 0, scheduledSeconds: 0, lastSeen: now }; workUsage.push(item); }
    item.seconds += delta / 1000; item.lastSeen = now; item.name = user.name;
    let minute = parts.hour * 60 + parts.minute;
    if (minute >= minutesFromTime(accountPreferences.workHours.start) && minute < minutesFromTime(accountPreferences.workHours.end)) item.scheduledSeconds += delta / 1000;
    workUsage = workUsage.filter(entry => entry.date >= new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10));
    saveState();
  }
  setInterval(() => recordUsageTick(false), 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) recordUsageTick(false); else { lastUsageTick = Date.now(); lastInteraction = Date.now(); } });
  addEventListener('beforeunload', () => recordUsageTick(false));
})();
