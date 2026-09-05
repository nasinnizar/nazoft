(() => {
  const mobileQuery = matchMedia('(max-width: 980px)');
  const body = document.body;
  const sidebar = document.querySelector('.side');
  const toggle = document.querySelector('#sidebarToggle');
  const brand = sidebar?.querySelector('.brand');
  if (!sidebar || !toggle || !brand) return;

  // Preview a collapsed desktop sidebar on hover without changing the saved preference.
  const shell = sidebar.closest('.app');
  const hoverQuery = matchMedia('(min-width:981px) and (hover:hover) and (pointer:fine)');
  let previewing = false;
  function previewSidebar() {
    if (!hoverQuery.matches || !shell.classList.contains('sidebar-collapsed')) return;
    previewing = true;
    shell.classList.remove('sidebar-collapsed');
    shell.classList.add('sidebar-hover-preview');
    toggle.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-label','Pin sidebar open');
    toggle.title='Pin sidebar open';
  }
  function closePreview(force = false) {
    if (!previewing || (!force && sidebar.contains(document.activeElement))) return;
    previewing = false;
    shell.classList.remove('sidebar-hover-preview');
    setSidebarCollapsed(true);
  }
  sidebar.addEventListener('pointerenter',previewSidebar);
  sidebar.addEventListener('pointerleave',()=>closePreview());
  toggle.addEventListener('click',event=>{
    if (!previewing || mobileQuery.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    previewing=false;
    shell.classList.remove('sidebar-hover-preview');
    setSidebarCollapsed(false);
  },true);
  hoverQuery.addEventListener?.('change',()=>closePreview(true));

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'mobile-sidebar-backdrop';
  backdrop.setAttribute('aria-label', 'Close navigation');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'mobile-sidebar-close';
  closeButton.setAttribute('aria-label', 'Close navigation');
  closeButton.innerHTML = '<span aria-hidden="true">×</span>';

  body.appendChild(backdrop);
  brand.appendChild(closeButton);

  function isOpen() {
    return body.classList.contains('mobile-sidebar-open');
  }

  function syncAccessibility() {
    const mobile = mobileQuery.matches;
    const collapsed = document.querySelector('.app')?.classList.contains('sidebar-collapsed');
    sidebar.setAttribute('aria-hidden', mobile && !isOpen() ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', String(mobile ? isOpen() : !collapsed));
    toggle.setAttribute('aria-label', mobile ? (isOpen() ? 'Close navigation' : 'Open navigation') : (collapsed ? 'Expand sidebar' : 'Collapse sidebar'));
  }

  function openSidebar() {
    body.classList.add('mobile-sidebar-open');
    syncAccessibility();
    requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
  }

  function closeSidebar(restoreFocus = false) {
    body.classList.remove('mobile-sidebar-open');
    syncAccessibility();
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', event => {
    if (!mobileQuery.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    isOpen() ? closeSidebar() : openSidebar();
  }, true);

  backdrop.addEventListener('click', () => closeSidebar(true));
  closeButton.addEventListener('click', () => closeSidebar(true));
  sidebar.querySelector('.nav')?.addEventListener('click', event => {
    if (mobileQuery.matches && event.target.closest('button[data-page]')) closeSidebar();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) closeSidebar(true);
  });
  mobileQuery.addEventListener?.('change', () => {
    if (!mobileQuery.matches) body.classList.remove('mobile-sidebar-open');
    syncAccessibility();
  });

  syncAccessibility();
})();
