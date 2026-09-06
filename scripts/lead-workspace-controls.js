(() => {
  const drawer = document.querySelector('#drawer');
  if (!drawer || typeof openLead !== 'function') return;

  const leadForm = document.querySelector('#leadForm');
  ['product', 'value', 'notes'].forEach(name => {
    leadForm.elements[name].closest('.field').style.display = 'none';
  });
  const contactStatus = leadForm.elements.status;
  contactStatus.closest('.field').classList.add('hidden');
  // Contact details cannot change the status controlled by the pipeline.
  leadForm.addEventListener('submit', () => {
    const index = leadForm.elements.index.value;
    const existing = index === '' ? null : leads[Number(index)];
    if (existing?.product && ![...leadForm.elements.product.options].some(option => option.value === existing.product)) {
      leadForm.elements.product.add(new Option(existing.product, existing.product));
    }
    ['product', 'value', 'notes'].forEach(name => {
      leadForm.elements[name].value = existing?.[name] ?? (name === 'value' ? 0 : '');
    });
    contactStatus.value = index === '' ? 'Uncontacted' : (leads[Number(index)]?.status || 'Uncontacted');
  }, true);

  // Independent stacks let each card keep its natural height.
  const mainColumn = document.createElement('div');
  mainColumn.className = 'lead-workspace-main';
  const sideColumn = document.createElement('div');
  sideColumn.className = 'lead-workspace-side';
  ['lead-summary-panel', 'lead-info-panel', 'lead-timeline-panel'].forEach(name => {
    const panel = drawer.querySelector(`.${name}`);
    if (panel) mainColumn.appendChild(panel);
  });
  ['lead-followup-panel', 'lead-notes-panel'].forEach(name => {
    const panel = drawer.querySelector(`.${name}`);
    if (panel) sideColumn.appendChild(panel);
  });
  drawer.append(mainColumn, sideColumn);

  const menu = drawer.querySelector('#leadMenu');
  menu?.querySelector('[data-lead-action="notes"]')?.remove();
  if (menu && !menu.querySelector('.lead-menu-close')) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lead-menu-close';
    close.setAttribute('aria-label', 'Close client actions');
    close.innerHTML = typeof uiIcon === 'function' ? uiIcon('x') : '×';
    close.onclick = () => { menu.classList.add('hidden'); drawer.querySelector('#moreLead')?.focus(); };
    menu.prepend(close);
  }
  document.addEventListener('pointerdown', event => {
    if (menu?.classList.contains('hidden') || event.target.closest('#leadMenu,#moreLead')) return;
    menu.classList.add('hidden');
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || menu?.classList.contains('hidden')) return;
    menu.classList.add('hidden');
    drawer.querySelector('#moreLead')?.focus();
  });
  const vcardEscape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  ['uncontacted', 'phonebook', 'share'].forEach(action => {
    const button = menu?.querySelector(`[data-lead-action="${action}"]`);
    if (!button) return;
    button.onclick = async () => {
      const lead = leads[currentLead];
      menu.classList.add('hidden');
      if (!lead) return;
      if (action === 'uncontacted') {
        if (!hasPermission('Edit leads')) return toast('Your role cannot edit leads');
        const index = stages.findIndex(stage => stage[0].toLowerCase() === 'not connected');
        if (index < 0) return toast('Add a Not connected stage in pipeline settings first');
        commitPipelineStage(currentLead, index, lead.pipeline);
        saveState();
        renderLeads(); renderBoard(); renderToday(); renderActivities();
        openLead(currentLead);
        return toast('Lead moved to Not connected');
      }
      if (action === 'phonebook') {
        const card = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardEscape(lead.name)}`, `ORG:${vcardEscape(lead.company)}`, `TEL;TYPE=CELL:${vcardEscape(lead.phone)}`, `EMAIL:${vcardEscape(lead.email)}`, 'END:VCARD'].join('\r\n');
        const url = URL.createObjectURL(new Blob([card], { type: 'text/vcard;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'client-contact.vcf';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return toast('Contact card downloaded · open it to add to your contacts');
      }
      const summary = [lead.name, lead.company, lead.phone, lead.email, lead.product].filter(Boolean).join('\n');
      try {
        if (navigator.share) {
          await navigator.share({ title: `${lead.name} · client details`, text: summary });
          toast('Client details shared');
        } else {
          await navigator.clipboard.writeText(summary);
          toast('Client details copied for sharing');
        }
      } catch {
        if (!navigator.share) window.prompt('Copy these client details to share:', summary);
      }
    };
  });

  const text = value => String(value ?? '');
  function renderSavedNotes(lead) {
    const panel = drawer.querySelector('.lead-notes-panel');
    let list = panel.querySelector('.saved-private-notes');
    if (!list) {
      list = document.createElement('div');
      list.className = 'saved-private-notes';
      list.setAttribute('aria-label', 'Saved private notes');
      list.setAttribute('aria-live', 'polite');
      panel.appendChild(list);
    }
    const notes = (lead.timeline || []).filter(item => item.title === 'Private note');
    if (!notes.length && lead.notes) notes.push({ detail: lead.notes });
    const region = accountPreferences.regional || {};
    list.innerHTML = notes.map(note => {
      const date = note.at ? new Date(note.at) : null;
      const validDate = date && !Number.isNaN(date.getTime());
      const when = validDate ? new Intl.DateTimeFormat(region.locale || undefined, {
        dateStyle: 'medium', timeStyle: 'short', ...(region.timeZone ? { timeZone: region.timeZone } : {})
      }).format(date) : 'Date not recorded';
      return `<article class="saved-private-note"><p>${safe(note.detail || '')}</p><small><time${validDate ? ` datetime="${date.toISOString()}"` : ''}>${safe(when)}</time>${note.actor ? ` · ${safe(note.actor)}` : ''}</small></article>`;
    }).join('');
    list.hidden = !notes.length;
  }
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
      const mode = drawer.querySelector('#drawerMeta .lead-quality');
      if (mode) qualification.prepend(mode);
    }

    const pipelineBadge = drawer.querySelector('#drawerMeta .pipeline-summary .pill');
    if (pipelineBadge && hasPermission('Edit leads')) {
      const change = document.createElement('button');
      change.type = 'button';
      change.className = 'btn small workspace-pipeline-change';
      change.textContent = `${pipelineBadge.textContent} · Change`;
      change.setAttribute('aria-label', 'Change pipeline');
      change.onclick = openPipelineMove;
      pipelineBadge.replaceWith(change);
    }
    drawer.querySelectorAll('#clientInfo > p').forEach(row => {
      const label = row.querySelector('.muted')?.textContent.trim();
      if (label === 'Notes') row.remove();
      if (label === 'Opportunity size' && hasPermission('Edit leads')) {
        row.classList.add('client-info-editable');
        row.innerHTML = `<span class="muted">Opportunity size</span><span class="client-info-value">SAR ${Number(lead.value || 0).toLocaleString()}</span>`;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'btn small workspace-value-change';
        edit.textContent = 'Change';
        edit.setAttribute('aria-label', 'Change opportunity size');
        edit.onclick = () => {
          editClientValue(lead, 'value');
        };
        row.appendChild(edit);
      }
    });
    const productRow = document.createElement('p');
    productRow.className = 'client-info-editable';
    productRow.innerHTML = `<span class="muted">Product / service</span><span class="client-info-value">${safe(lead.product || 'Not selected')}</span>`;
    if (hasPermission('Edit leads')) {
      const change = document.createElement('button');
      change.type = 'button'; change.className = 'btn small workspace-value-change'; change.textContent = 'Change';
      change.onclick = () => editClientValue(lead, 'product'); productRow.appendChild(change);
    }
    document.querySelector('#clientInfo').appendChild(productRow);

    document.querySelector('#quickResponse')?.closest('.row-actions')?.classList.add('lead-primary-actions');
    renderSavedNotes(lead);
    return result;
  };
  function editClientValue(lead, field) {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'border:1px solid var(--line);border-radius:16px;padding:24px;width:min(420px,90vw);background:var(--surface,#fff);color:var(--ink)';
    dialog.innerHTML = `<form><h2>${field === 'value' ? 'Opportunity size' : 'Product / service'}</h2><div class="field">${field === 'value' ? `<input aria-label="Opportunity size" type="number" min="0" step="any" required value="${Number(lead.value)||0}">` : `<select aria-label="Product / service"><option value="">Not selected</option>${[...new Set([lead.product,...products.map(p=>p.name)].filter(Boolean))].map(p=>optionMarkup(p,p,lead.product)).join('')}</select>`}</div><div class="actions-end"><button type="button" class="btn">Cancel</button><button class="btn primary">Save</button></div></form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[type="button"]').onclick=()=>dialog.close();
    dialog.onclose=()=>dialog.remove();
    dialog.querySelector('form').onsubmit=e=>{
      e.preventDefault(); if(!hasPermission('Edit leads')) return;
      const value=dialog.querySelector('input,select').value;
      if(field==='value'&&(!Number.isFinite(Number(value))||Number(value)<0))return;
      lead[field]=field==='value'?Number(value):value;
      addTimeline(lead, field==='value'?'Opportunity size updated':'Product updated',String(lead[field]));
      saveState(); renderLeads();renderBoard();openLead(currentLead);dialog.close();toast('Client data saved');
    };
    dialog.showModal();
  }
})();
