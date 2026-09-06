(() => {
  const pipeline = document.querySelector('#pipeline');
  const toolbar = pipeline?.querySelector('.pipeline-toolbar');
  const filters = document.querySelector('#pipeFilters');
  const filterButton = document.querySelector('#pipeFilterBtn');
  const sortSelect = document.querySelector('#pipeSort');

  if (toolbar && filters && filterButton && sortSelect) {
    const sortControl = sortSelect.closest('.select-ui') || sortSelect;
    const sortGroup = document.createElement('div');
    sortGroup.className = 'pipeline-sort-control';
    sortGroup.innerHTML = '<span class="crm-control-label">Sort by</span>';
    sortControl.before(sortGroup);
    sortGroup.append(sortControl);

    filterButton.className = 'btn pipeline-filter-toggle';
    filterButton.removeAttribute('aria-hidden');
    filterButton.setAttribute('aria-controls', 'pipeFilters');
    toolbar.insertBefore(filterButton, toolbar.lastElementChild);
    const syncFilters = open => {
      filters.classList.toggle('open', open);
      filterButton.setAttribute('aria-expanded', String(open));
      filterButton.innerHTML = `${typeof uiIcon === 'function' ? uiIcon('sliders') : ''}<span>${open ? 'Hide filters' : 'Show filters'}</span>`;
    };
    filterButton.onclick = event => {
      event.stopPropagation();
      syncFilters(!filters.classList.contains('open'));
    };
    syncFilters(filters.classList.contains('open'));
  }

  const shortcuts = [
    ['⌘K', 'Search CRM'],
    ['⌘⇧L', 'Add lead'],
    ['⌘⇧A', 'Add activity'],
    ['⌘⇧T', 'Add task'],
    ['Enter', 'Next field in a form']
  ];
  const help = document.createElement('div');
  help.className = 'shortcut-dialog hidden';
  help.setAttribute('role', 'dialog');
  help.setAttribute('aria-modal', 'true');
  help.setAttribute('aria-labelledby', 'shortcutTitle');
  help.innerHTML = `<div class="shortcut-card"><div class="modalhead"><div><div class="eyebrow">Work faster</div><h2 id="shortcutTitle">Keyboard shortcuts</h2></div><button type="button" class="close" aria-label="Close shortcuts">×</button></div><div class="shortcut-list">${shortcuts.map(([key,label])=>`<div><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</div><p class="muted">Press <kbd>?</kbd> anywhere outside a text field to open this list.</p></div>`;
  document.body.append(help);
  const closeHelp = () => help.classList.add('hidden');
  help.querySelector('.close').onclick = closeHelp;
  help.onclick = event => { if (event.target === help) closeHelp(); };

  const shortcutText = (mac, other) => navigator.platform?.includes('Mac') ? mac : other;
  const annotate = (element, keys, label) => {
    if (!element) return;
    element.setAttribute('aria-keyshortcuts', keys);
    element.title = `${label} (${shortcutText(keys.replace('Meta','⌘').replaceAll('+',''), keys.replace('Meta','Ctrl'))})`;
  };
  annotate(document.querySelector('.top-actions .addLead'), 'Meta+Shift+L', 'Add lead');
  annotate(document.querySelector('#quickActivity'), 'Meta+Shift+A', 'Add activity');
  annotate(document.querySelector('#createCrmTask'), 'Meta+Shift+T', 'Add task');
  annotate(document.querySelector('#globalSearch'), 'Meta+K', 'Search CRM');

  const editable = target => target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable="true"]');
  const openLead = () => document.querySelector('.top-actions .addLead:not(.hidden)')?.click();
  const openActivity = () => document.querySelector('#quickActivity:not(.hidden)')?.click();
  const openTask = () => {
    const nav = document.querySelector('.nav [data-page="tasks"]');
    if (!nav) return;
    nav.click();
    requestAnimationFrame(() => document.querySelector('#createCrmTask:not(.hidden)')?.click());
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !help.classList.contains('hidden')) return closeHelp();
    if (!editable(event.target) && event.key === '?') {
      event.preventDefault();
      help.classList.remove('hidden');
      return help.querySelector('.close').focus();
    }
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.altKey) return;
    const key = event.key.toLowerCase();
    const actions = { l: openLead, a: openActivity, t: openTask };
    if (!actions[key]) return;
    event.preventDefault();
    actions[key]();
  });

  // Enter advances through CRM forms in visual/DOM order. Textareas keep Enter
  // for line breaks; the last field keeps normal form submission behaviour.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const current = event.target;
    if (!(current instanceof HTMLInputElement) || ['checkbox','radio','submit','button','hidden','file'].includes(current.type)) return;
    const form = current.closest('form');
    if (!form || form.closest('#login')) return;
    const fields = [...form.querySelectorAll('input,select,textarea,button.pretty-select-trigger')].filter(element => {
      if (!(element instanceof HTMLElement) || element.matches('[disabled],[type="hidden"],[type="submit"],[type="button"],textarea')) return false;
      return element.offsetParent !== null;
    });
    const next = fields[fields.indexOf(current) + 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  });
})();
