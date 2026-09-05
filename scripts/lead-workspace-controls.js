(() => {
  const drawer = document.querySelector('#drawer');
  if (!drawer || typeof openLead !== 'function') return;

  const text = value => String(value ?? '');
  const optionMarkup = (value, label, selected) => `<option value="${safe(value)}" ${value === selected ? 'selected' : ''}>${safe(label)}</option>`;

  function ensureAssociationControl(kind, badge, items, lead, config) {
    const row = badge?.closest('p');
    if (!row) return;
    row.classList.add('drawer-context-row', `drawer-${kind}-row`);
    row.querySelector('br')?.remove();
    badge.hidden = true;

    let controls = row.querySelector('.lead-association-controls');
    let select = row.querySelector(`#${config.id}`);
    if (!controls) {
      controls = document.createElement('span');
      controls.className = 'lead-association-controls';
      select = document.createElement('select');
      select.id = config.id;
      select.setAttribute('aria-label', config.ariaLabel);
      controls.appendChild(select);
      const manage = row.querySelector('[data-open-setting]');
      if (manage) {
        manage.textContent = config.manageLabel;
        controls.appendChild(manage);
      }
      badge.insertAdjacentElement('afterend', controls);
    }

    const current = text(lead[config.field] || config.emptyValue);
    const values = items.map(item => text(item.name)).filter(Boolean);
    if (current !== config.emptyValue && !values.includes(current)) values.unshift(current);
    select.innerHTML = optionMarkup('', config.emptyLabel, current === config.emptyValue ? '' : current) + values.map(value => optionMarkup(value, value, current)).join('');
    select.value = current === config.emptyValue ? '' : current;
    select.disabled = typeof hasPermission === 'function' && !hasPermission('Edit leads');

    const helpText = config.help;
    let help = row.querySelector('.drawer-context-help');
    if (!help) {
      help = document.createElement('small');
      help.className = 'drawer-context-help';
      row.appendChild(help);
    }
    help.textContent = helpText;

    select.onchange = event => {
      const next = event.target.value || config.emptyValue;
      const previous = text(lead[config.field] || config.emptyValue);
      if (next === previous) return;
      lead[config.field] = next;
      addTimeline(lead, config.timelineTitle(next), `${previous} → ${next}`);
      feed.unshift([config.feedLabel, lead.name, `${previous} → ${next}`, new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), currentUser().email || currentUser().name]);
      saveState();
      renderLeads(document.querySelector('#leadSearch')?.value || '');
      renderBoard(document.querySelector('#boardSearch')?.value || '');
      renderActivities();
      renderToday();
      renderSalesPerformance();
      renderCompleteLeadTimeline(lead);
      toast(config.success(next));
    };

    upgradeSelects(row);
    refreshEnhancedSelect(select);
  }

  const openLeadControlsBase = openLead;
  openLead = function (index) {
    const result = openLeadControlsBase(index);
    const lead = leads[index];
    if (!lead) return result;

    ensureAssociationControl('group', document.querySelector('#drawerGroups'), groups, lead, {
      id: 'drawerGroupSelect',
      ariaLabel: 'Client group',
      field: 'group',
      emptyValue: 'No group',
      emptyLabel: 'No group',
      manageLabel: 'Manage groups',
      help: 'Groups are reusable client segments for filters, reports, and bulk actions.',
      feedLabel: 'Client group',
      timelineTitle: () => 'Client group changed',
      success: value => value === 'No group' ? 'Client removed from group' : `Client added to ${value}`
    });

    const availableSequences = sequences.filter(sequence => sequence.enabled || sequence.name === lead.sequence);
    ensureAssociationControl('sequence', document.querySelector('#drawerSequence'), availableSequences, lead, {
      id: 'drawerSequenceSelect',
      ariaLabel: 'Follow-up sequence',
      field: 'sequence',
      emptyValue: 'Not enrolled',
      emptyLabel: 'Not enrolled',
      manageLabel: 'Manage sequences',
      help: 'Sequences are reusable follow-up plans made from messages, calls, files, and timed steps.',
      feedLabel: 'Follow-up sequence',
      timelineTitle: value => value === 'Not enrolled' ? 'Follow-up sequence removed' : 'Follow-up sequence enrolled',
      success: value => value === 'Not enrolled' ? 'Client removed from sequence' : `Client enrolled in ${value}`
    });

    const qualification = document.querySelector('#drawerQualification');
    const followupPanel = drawer.querySelector('.lead-followup-panel');
    if (qualification && followupPanel) {
      qualification.classList.add('followup-qualification');
      followupPanel.appendChild(qualification);
    }

    document.querySelector('#quickResponse')?.closest('.row-actions')?.classList.add('lead-primary-actions');
    return result;
  };
})();
