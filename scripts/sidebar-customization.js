(() => {
  const nav = document.querySelector('.side .nav');
  if (!nav) return;

  const pagePermission = {
    today: 'View dashboard', tasks: 'View tasks', leads: 'View leads', pipeline: 'View pipeline',
    proposals: 'View proposals', library: 'View content', activities: 'View activities', performance: 'View reports',
    settings: 'View settings',
  };
  const settingPermission = {
    regional: 'Manage regional settings', company: 'Edit CRM settings', branding: 'Manage branding', numbering: 'Edit CRM settings',
    fields: 'Manage fields', pipelines: 'Manage pipelines', products: 'Manage products', groups: 'Manage client groups', sources: 'Manage lead sources',
    documents: 'Edit CRM settings', sequences: 'Manage automations', followups: 'Manage follow-ups', contactRules: 'Manage automations',
    notifications: 'Manage notifications', personalisation: 'Edit CRM settings', leadForms: 'Manage forms',
    meta: 'Manage integrations', google: 'Manage integrations', website: 'Manage integrations', data: 'Export data',
    users: 'View team', access: 'Manage permissions', workHours: 'Edit CRM settings', profile: null,
  };
  const storageKey = `nazoft-sidebar-order:${String(currentUser()?.email || 'workspace').toLowerCase()}`;
  let arranging = false, longPressTimer = 0, pressPoint = null, suppressClick = false;

  function buttons() { return [...nav.querySelectorAll(':scope > button[data-page]')]; }
  function navButton(target) { const button = target.closest?.('button[data-page]'); return button?.parentElement === nav ? button : null; }

  function applyStoredOrder() {
    let order = [];
    try { order = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
    if (!Array.isArray(order)) return;
    const byPage = new Map(buttons().map(button => [button.dataset.page, button]));
    order.forEach(page => { const button = byPage.get(page); if (button) nav.append(button); });
    buttons().filter(button => !order.includes(button.dataset.page)).forEach(button => nav.append(button));
  }

  function saveOrder() {
    try { localStorage.setItem(storageKey, JSON.stringify(buttons().map(button => button.dataset.page))); } catch {}
  }

  function refreshAccess() {
    const currentPermissions = currentUser()?.permissions || [];
    const legacyNavigation = !currentPermissions.some(permission => Object.values(pagePermission).includes(permission));
    buttons().forEach(button => {
      const permission = pagePermission[button.dataset.page];
      button.classList.toggle('role-hidden', Boolean(permission && !legacyNavigation && !hasPermission(permission)));
    });
    document.querySelectorAll('#newProposal').forEach(button => { button.hidden = !hasPermission('Create proposals'); });
    document.querySelectorAll('#drawer [data-proposal]').forEach(button => { button.hidden = !hasPermission('View proposals'); });
    document.querySelectorAll('#board .deal').forEach(card => { card.draggable = hasPermission('Move pipeline leads') || hasPermission('Edit leads'); });
    document.querySelectorAll('#newContent').forEach(button => { button.hidden = !hasPermission('Create content') && !hasPermission('Edit leads'); });
    document.querySelectorAll('.editAsset').forEach(button => { button.hidden = !hasPermission('Edit content') && !hasPermission('Edit leads'); });
    document.querySelectorAll('.deleteAsset').forEach(button => { button.hidden = !hasPermission('Delete content') && !hasPermission('Delete leads'); });
    document.querySelectorAll('.sendAsset').forEach(button => { button.hidden = !hasPermission('Send content') && !hasPermission('Edit leads'); });
    document.querySelectorAll('.settings-menu [data-setting]').forEach(button => {
      const permission = settingPermission[button.dataset.setting];
      button.classList.toggle('hidden', Boolean(permission && !hasPermission(permission) && !hasPermission('Edit CRM settings')));
    });
  }

  function finishArrange() {
    if (!arranging) return;
    arranging = false;
    nav.classList.remove('is-arranging');
    buttons().forEach(button => { button.draggable = false; button.removeAttribute('aria-grabbed'); });
    nav.querySelector('.sidebar-arrange-done')?.remove();
    saveOrder();
    toast('Sidebar order saved');
  }

  function startArrange() {
    if (arranging) return;
    arranging = true;
    suppressClick = true;
    nav.classList.add('is-arranging');
    buttons().forEach(button => { button.draggable = true; button.setAttribute('aria-grabbed', 'false'); });
    const done = document.createElement('button');
    done.type = 'button'; done.className = 'sidebar-arrange-done'; done.textContent = 'Done rearranging';
    done.onclick = event => { event.stopPropagation(); finishArrange(); };
    nav.append(done);
    toast('Drag sidebar items into your preferred order');
  }

  nav.addEventListener('pointerdown', event => {
    const button = navButton(event.target);
    if (button?.classList.contains('role-hidden')) return;
    if (!button || arranging || event.button > 0) return;
    pressPoint = { x: event.clientX, y: event.clientY };
    longPressTimer = window.setTimeout(startArrange, 520);
  });
  nav.addEventListener('pointermove', event => {
    if (!pressPoint || arranging) return;
    if (Math.hypot(event.clientX - pressPoint.x, event.clientY - pressPoint.y) > 8) clearTimeout(longPressTimer);
  });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) nav.addEventListener(name, () => { clearTimeout(longPressTimer); pressPoint = null; });
  nav.addEventListener('click', event => {
    if (!arranging && !suppressClick) return;
    if (suppressClick) suppressClick = false;
    if (event.target.closest('.sidebar-arrange-done')) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  nav.addEventListener('dragstart', event => {
    const button = navButton(event.target);
    if (!arranging || !button) return event.preventDefault();
    button.classList.add('is-dragging'); button.setAttribute('aria-grabbed', 'true');
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', button.dataset.page);
  });
  nav.addEventListener('dragover', event => {
    if (!arranging) return;
    event.preventDefault();
    const dragging = nav.querySelector('.is-dragging'), target = navButton(event.target);
    if (target?.classList.contains('role-hidden')) return;
    if (!dragging || !target || dragging === target) return;
    const rect = target.getBoundingClientRect();
    nav.insertBefore(dragging, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
  });
  nav.addEventListener('dragend', event => {
    const button = navButton(event.target);
    button?.classList.remove('is-dragging'); button?.setAttribute('aria-grabbed', 'false'); saveOrder();
  });
  nav.addEventListener('keydown', event => {
    if (!arranging || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const button = navButton(event.target);
    if (button?.classList.contains('role-hidden')) return;
    if (!button) return;
    event.preventDefault();
    const visible = buttons().filter(item => !item.classList.contains('role-hidden')), index = visible.indexOf(button);
    const target = visible[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (!target) return;
    nav.insertBefore(button, event.key === 'ArrowUp' ? target : target.nextSibling); button.focus(); saveOrder();
  });

  const pageBase = page;
  page = function (id) {
    const permission = pagePermission[id];
    if (permission && !hasPermission(permission)) {
      toast('Your role cannot open this area');
      return;
    }
    return pageBase(id);
  };

  const selectSettingBase = selectSetting;
  selectSetting = function (name) {
    const permission = settingPermission[name];
    if (permission && !hasPermission(permission) && !hasPermission('Edit CRM settings')) {
      toast('Your role cannot open this setting'); return;
    }
    return selectSettingBase(name);
  };

  document.addEventListener('dragstart', event => {
    if (event.target.closest?.('#board .deal') && !hasPermission('Move pipeline leads') && !hasPermission('Edit leads')) {
      event.preventDefault(); toast('Your role cannot move pipeline leads');
    }
  }, true);

  new MutationObserver(refreshAccess).observe(document.body, { childList: true, subtree: true });
  applyStoredOrder(); refreshAccess();

  const style = document.createElement('style');
  style.textContent = `.side .nav>button.role-hidden{display:none!important}.side .nav.is-arranging{padding:7px;border:1px dashed color-mix(in srgb,var(--blue) 55%,var(--line));border-radius:13px;background:color-mix(in srgb,var(--blue2) 42%,transparent)}.side .nav.is-arranging>button[data-page]{cursor:grab}.side .nav.is-arranging>button[data-page]::after{content:'⋮⋮';margin-left:auto;color:var(--muted);letter-spacing:-3px}.side .nav.is-arranging>button.is-dragging{opacity:.46;cursor:grabbing}.side .nav .sidebar-arrange-done{justify-content:center!important;margin-top:5px!important;border:1px solid var(--line)!important;background:var(--white)!important;color:var(--blue)!important;font-size:11px!important}.app.sidebar-collapsed .side .nav.is-arranging{padding:4px}`;
  document.head.appendChild(style);
})();
