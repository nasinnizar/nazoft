(() => {
  const excluded = '.public-form-card,.login-card,.proposal-review';
  let sequence = 0;

  function decorate(root = document) {
    const forms = [...(root.querySelectorAll?.('form') || [])];
    if (root.matches?.('form')) forms.push(root);
    forms.forEach(form => {
      if (form.matches(excluded) || form.closest('.public-form-card')) return;
      form.classList.add('crm-horizontal-form');
      form.querySelectorAll('.field').forEach(field => {
        const label = field.matches('label.field') ? field : field.querySelector(':scope > label');
        const control = field.querySelector('input:not([type="hidden"]),select,textarea');
        if (!label || !control) return;
        field.classList.add('crm-horizontal-field');
        if (!control.id) control.id = `crm-field-${++sequence}`;
        if (label !== field && !label.htmlFor) label.htmlFor = control.id;
      });
    });
  }

  decorate();
  let queued = false;
  new MutationObserver(records => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) decorate(node);
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
