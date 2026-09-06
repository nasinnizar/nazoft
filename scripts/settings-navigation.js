(() => {
  const menu = document.querySelector('#settings .settings-menu');
  const pane = document.querySelector('#settingsPane');
  if (!menu || !pane) return;

  const groups = [
    {
      id: 'general', label: 'General', icon: 'sliders',
      items: [['regional', 'General'], ['company', 'Company details'], ['branding', 'Brand & reports'], ['numbering', 'Record numbering']]
    },
    {
      id: 'sales', label: 'Sales setup', icon: 'briefcase',
      items: [['fields', 'Fields'], ['pipelines', 'Pipelines'], ['products', 'Products & services'], ['groups', 'Client groups'], ['sources', 'Lead sources']]
    },
    {
      id: 'automation', label: 'Automation', icon: 'spark',
      items: [['documents', 'Documents'], ['sequences', 'Sequences'], ['followups', 'Follow-up rules'], ['contactRules', 'Lead automation']]
    },
    {
      id: 'communication', label: 'Communication', icon: 'message',
      items: [['notifications', 'Notifications'], ['personalisation', 'Personalization'], ['leadForms', 'Forms']]
    },
    {
      id: 'integrations', label: 'Integrations', icon: 'link',
      items: [['meta', 'Meta'], ['google', 'Google Ads'], ['website', 'Forms & webhooks'], ['data', 'Data & storage']]
    },
    {
      id: 'team', label: 'Team & account', icon: 'person',
      items: [['users', 'People'], ['access', 'Roles & permissions'], ['workHours', 'Work hours'], ['profile', 'Account & security']]
    }
  ];

  const icons = {
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
    spark: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };

  const buttons = new Map([...menu.querySelectorAll('button[data-setting]')].map(button => [button.dataset.setting, button]));
  buttons.get('templates')?.remove();
  buttons.delete('templates');
  const labels = new Map(groups.flatMap(group => group.items));
  const groupForSetting = new Map(groups.flatMap(group => group.items.map(([setting]) => [setting, group.id])));
  const fragment = document.createDocumentFragment();

  function icon(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  }

  groups.forEach(group => {
    const available = group.items.filter(([setting]) => buttons.has(setting));
    if (!available.length) return;
    const section = document.createElement('section');
    section.className = 'settings-nav-group';
    section.dataset.settingsGroup = group.id;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'settings-group-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = `<span class="settings-group-icon">${icon(group.icon)}</span><span>${group.label}</span><svg class="settings-group-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 8 3 3 3-3"/></svg>`;
    const items = document.createElement('div');
    items.className = 'settings-group-items';
    items.hidden = true;
    items.id = `settings-group-${group.id}`;
    toggle.setAttribute('aria-controls', items.id);
    available.forEach(([setting, label]) => {
      const button = buttons.get(setting);
      button.textContent = label;
      button.classList.add('settings-destination');
      items.append(button);
    });
    toggle.addEventListener('click', event => {
      // Group headings only reveal navigation; they are not actions that need a toast.
      event.stopPropagation();
      setOpenGroup(group.id, toggle.getAttribute('aria-expanded') !== 'true');
    });
    section.append(toggle, items);
    fragment.append(section);
  });

  [...buttons.entries()].filter(([setting]) => !groupForSetting.has(setting)).forEach(([, button]) => {
    fragment.lastElementChild?.querySelector('.settings-group-items')?.append(button);
  });
  menu.replaceChildren(fragment);
  menu.setAttribute('aria-label', 'Settings categories');

  function setOpenGroup(id, open = true) {
    menu.querySelectorAll('.settings-nav-group').forEach(section => {
      const expanded = open && section.dataset.settingsGroup === id;
      section.classList.toggle('is-open', expanded);
      section.querySelector('.settings-group-toggle').setAttribute('aria-expanded', String(expanded));
      section.querySelector('.settings-group-items').hidden = !expanded;
    });
  }

  function syncActiveSetting() {
    const active = menu.querySelector('button[data-setting].active');
    if (!active) return;
    const groupId = groupForSetting.get(active.dataset.setting);
    if (groupId && active.closest('.settings-group-items')?.hidden) setOpenGroup(groupId);
    const title = labels.get(active.dataset.setting);
    const heading = pane.querySelector('.setting-view.active h2');
    if (title && heading && heading.textContent.trim() !== title) heading.textContent = title;
  }

  menu.addEventListener('click', event => {
    if (event.target.closest('button[data-setting]')) queueMicrotask(syncActiveSetting);
  });
  new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' || record.target.matches?.('button[data-setting]'))) queueMicrotask(syncActiveSetting);
  }).observe(document.querySelector('#settings'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  const initial = menu.querySelector('button[data-setting].active')?.dataset.setting || 'fields';
  setOpenGroup(groupForSetting.get(initial) || groups[0].id);
  syncActiveSetting();
})();
