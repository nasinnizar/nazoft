(() => {
  const stack = document.querySelector('#toast');
  if (!stack) return;
  const inlineAlertSelector = '[role="alert"],.auth-status,[data-status],#routingStatus,#metaConnectionStatus,#inboundStatus';

  const iconPaths = {
    success: '<path d="m5 12 4 4L19 6"/>',
    destructive: '<path d="M12 8v5"/><path d="M12 17h.01"/><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/>',
    warning: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
  };

  const titles = {
    success: 'Completed',
    destructive: 'Something went wrong',
    warning: 'Action needed',
    info: 'Notice'
  };

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function alertVariant(message = '') {
    const value = String(message).toLowerCase();
    if (/\b(error|failed|failure|unable|cannot|can't|invalid|denied|blocked|unavailable|not configured|not include)\b/.test(value)) return 'destructive';
    if (/\b(saved|created|updated|sent|connected|ready|imported|exported|downloaded|cleared|refreshed|scheduled|working|confirmed|restored|completed)\b/.test(value)) return 'success';
    if (/\b(choose|select|enter|add|required|must|changed|missing|overdue|no rows|no changes|first)\b/.test(value)) return 'warning';
    return 'info';
  }

  function icon(variant) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[variant] || iconPaths.info}</svg>`;
  }

  function dismiss(alert) {
    if (!alert || alert.classList.contains('is-leaving')) return;
    clearTimeout(alert.dismissTimer);
    alert.classList.add('is-leaving');
    alert.addEventListener('animationend', () => alert.remove(), { once: true });
    setTimeout(() => alert.remove(), 260);
  }

  window.toast = function toast(message, preference = {}) {
    const options = typeof preference === 'string' ? { variant: preference } : preference || {};
    const variant = options.variant || alertVariant(message);
    const alert = document.createElement('article');
    alert.className = `crm-alert crm-alert-${variant}`;
    alert.setAttribute('role', variant === 'destructive' ? 'alert' : 'status');
    alert.innerHTML = `<span class="crm-alert-icon">${icon(variant)}</span><span class="crm-alert-content"><strong>${escapeHtml(options.title || titles[variant] || titles.info)}</strong><span>${escapeHtml(message)}</span></span><button type="button" class="crm-alert-close" aria-label="Dismiss notification"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>`;
    stack.prepend(alert);
    [...stack.querySelectorAll('.crm-alert')].slice(4).forEach(dismiss);
    requestAnimationFrame(() => alert.classList.add('is-visible'));
    alert.dismissTimer = setTimeout(() => dismiss(alert), Number(options.duration) || 4600);
    return alert;
  };

  stack.addEventListener('click', event => {
    const close = event.target.closest('.crm-alert-close');
    if (close) dismiss(close.closest('.crm-alert'));
  });

  function decorateInlineAlert(element) {
    if (!element?.matches?.(inlineAlertSelector) || element === stack || element.id === 'appLoader') return;
    const message = element.textContent.trim();
    element.classList.add('crm-inline-alert');
    element.dataset.alertVariant = alertVariant(message);
  }

  function decorateInlineAlerts(root = document) {
    if (root.matches?.(inlineAlertSelector)) decorateInlineAlert(root);
    root.querySelectorAll?.(inlineAlertSelector).forEach(decorateInlineAlert);
  }

  decorateInlineAlerts();
  new MutationObserver(records => records.forEach(record => {
    decorateInlineAlert(record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement);
    record.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE) decorateInlineAlerts(node); });
  })).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
