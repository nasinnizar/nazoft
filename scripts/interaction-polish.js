(() => {
  const nav = document.querySelector('.side .nav');
  if (nav && !nav.querySelector('[data-page="settings"]')) {
    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.dataset.page = 'settings';
    settingsButton.setAttribute('aria-label', 'Settings');
    settingsButton.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.09A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.09A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.15.4.36.75.65 1 .3.25.68.39 1.08.4H21v4h-.09a1.7 1.7 0 0 0-1.51 1.6Z"/></svg><span>Settings</span>';
    settingsButton.onclick = () => {
      page('settings');
      if (typeof hasPermission === 'function' && !hasPermission('Edit CRM settings') && !hasPermission('Manage users')) selectSetting('profile');
    };
    nav.append(settingsButton);
  }

  const accountMenu = document.querySelector('#accountMenu');
  if (accountMenu) {
    accountMenu.querySelector('#profileSettings')?.remove();
    const legacyManage = accountMenu.querySelector('#manageUsersMenu');
    if (legacyManage) { legacyManage.hidden = true; legacyManage.classList.add('hidden'); legacyManage.style.display = 'none'; }
    accountMenu.querySelector('.account-menu-label')?.remove();
    accountMenu.querySelector('.theme-options')?.remove();
    accountMenu.querySelectorAll('.account-menu-separator').forEach(separator => separator.remove());
    accountMenu.setAttribute('aria-label', 'Account actions');
  }

  const passwordEyeIcon = crossed => `<svg class="password-visibility-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/>${crossed ? '<path d="m4 4 16 16"/>' : ''}</svg>`;
  function addPasswordVisibility(input) {
    if (!input || input.closest('.password-control')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'password-control';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-visibility';
    button.innerHTML = passwordEyeIcon(false);
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-controls', input.id);
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.innerHTML = passwordEyeIcon(!visible);
      button.setAttribute('aria-label', `${visible ? 'Show' : 'Hide'} password`);
      button.setAttribute('aria-pressed', String(!visible));
    };
    wrapper.appendChild(button);
  }
  ['loginPassword', 'newResetPassword', 'confirmResetPassword'].forEach(id => addPasswordVisibility(document.getElementById(id)));

  const applyThemeBase = applyTheme;
  let themeTimer = 0;
  applyTheme = function (choice = themeChoice) {
    const html = document.documentElement;
    const next = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
    const changing = html.dataset.theme && html.dataset.theme !== next;
    if (changing && !matchMedia('(prefers-reduced-motion: reduce)').matches) html.classList.add('theme-transition');
    applyThemeBase(choice);
    clearTimeout(themeTimer);
    if (changing) themeTimer = setTimeout(() => html.classList.remove('theme-transition'), 240);
  };

  function appearanceMarkup() {
    const choice = document.documentElement.dataset.themeChoice || 'light';
    return `<section class="preference-section crm-appearance-setting"><h3>Appearance</h3><p class="muted">Choose how Nazoft CRM looks on this device.</p><div class="crm-theme-choices" role="group" aria-label="Appearance">${[['light','sun','Light'],['dark','moon','Dark'],['system','system','System']].map(([value,icon,label])=>`<button type="button" class="btn ${choice===value?'active':''}" data-settings-theme="${value}" aria-pressed="${choice===value}">${uiIcon(icon)}<span>${label}</span></button>`).join('')}</div></section>`;
  }

  const renderConfigSettingBase = renderConfigSetting;
  renderConfigSetting = function (name = currentSetting) {
    const result = renderConfigSettingBase(name);
    if (name !== 'personalisation') return result;
    const pane = document.querySelector('#settingsPane .setting-view.active');
    const actions = pane?.querySelector('.preference-actions');
    if (pane && !pane.querySelector('.crm-appearance-setting')) {
      actions?.insertAdjacentHTML('beforebegin', appearanceMarkup());
      pane.querySelectorAll('[data-settings-theme]').forEach(button => button.onclick = () => {
        applyTheme(button.dataset.settingsTheme);
        pane.querySelectorAll('[data-settings-theme]').forEach(item => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        toast(`${button.textContent.trim()} appearance selected`);
      });
    }
    return result;
  };

  const current = typeof currentSetting === 'string' ? currentSetting : '';
  if (current === 'personalisation') renderConfigSetting(current);

  const exactActivityTime = value => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));

  function normalizeActivityTimes() {
    const usedTimelineEntries = new Set();
    let changed = false;
    feed.forEach((item, feedIndex) => {
      if (!Array.isArray(item)) return;
      let timestamp = Number(item[5]);
      if (!Number.isFinite(timestamp) && item[3] && item[3] !== 'Just now') {
        const parsed = new Date(item[3]).getTime();
        if (Number.isFinite(parsed)) timestamp = parsed;
      }
      if (!Number.isFinite(timestamp)) {
        const lead = leads.find(candidate => candidate.name === item[1]);
        const timeline = Array.isArray(lead?.timeline) ? lead.timeline : [];
        const match = timeline.find((entry, timelineIndex) => {
          const key = `${lead?.leadNumber || lead?.name || 'lead'}:${timelineIndex}`;
          if (usedTimelineEntries.has(key) || !Number.isFinite(Number(entry.at))) return false;
          const sameDetail = String(entry.detail || '') === String(item[2] || '');
          const feedTitle = String(item[0] || '').toLowerCase();
          const timelineTitle = String(entry.title || '').toLowerCase();
          return sameDetail || timelineTitle.includes(feedTitle) || feedTitle.includes(timelineTitle);
        });
        if (match) {
          timestamp = Number(match.at);
          usedTimelineEntries.add(`${lead.leadNumber || lead.name || 'lead'}:${timeline.indexOf(match)}`);
        }
      }
      if (!Number.isFinite(timestamp)) return;
      const label = exactActivityTime(timestamp);
      if (item[3] !== label || item[5] !== timestamp) {
        item[3] = label;
        item[5] = timestamp;
        changed = true;
      }
      usedTimelineEntries.add(`feed:${feedIndex}`);
    });
    return changed;
  }

  const renderTodayActivityTimeBase = renderToday;
  renderToday = function (...args) {
    normalizeActivityTimes();
    return renderTodayActivityTimeBase(...args);
  };
  const renderActivitiesTimeBase = renderActivities;
  renderActivities = function (...args) {
    normalizeActivityTimes();
    return renderActivitiesTimeBase(...args);
  };
  if (normalizeActivityTimes()) saveState();
  renderActivities();
  renderToday();
})();
