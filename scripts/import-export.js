(() => {
  const mappingFields = [
    { key: 'name', label: 'Full name', required: true, aliases: ['name', 'full name', 'lead', 'client name'] },
    { key: 'phone', label: 'Mobile number', aliases: ['phone', 'mobile', 'mobile number'] },
    { key: 'whatsapp', label: 'WhatsApp number', aliases: ['whatsapp', 'whatsapp number'] },
    { key: 'email', label: 'Email', aliases: ['email', 'email address'] },
    { key: 'company', label: 'Company', aliases: ['company', 'organisation', 'organization'] },
    { key: 'source', label: 'Lead source', aliases: ['source', 'lead source'] },
    { key: 'product', label: 'Product / service', aliases: ['product', 'service', 'product / service'] },
    { key: 'status', label: 'Contact status', aliases: ['status', 'contact status'] },
    { key: 'temperature', label: 'Lead temperature', aliases: ['temperature', 'lead temperature', 'hot warm cold'] },
    { key: 'score', label: 'Feasibility score', aliases: ['score', 'feasibility', 'feasibility score', 'lead score'] },
    { key: 'value', label: 'Opportunity size SAR', aliases: ['value', 'opportunity size', 'opportunity size sar', 'opportunity value'] },
    { key: 'pipeline', label: 'Pipeline', aliases: ['pipeline'] },
    { key: 'stage', label: 'Pipeline stage', aliases: ['stage', 'pipeline stage'] },
    { key: 'due', label: 'Next follow-up', aliases: ['follow up', 'follow-up', 'next follow-up'] },
    { key: 'group', label: 'Client group', aliases: ['group', 'client group'] },
    { key: 'notes', label: 'Private notes', aliases: ['notes', 'note', 'private notes'] },
    { key: 'ownerEmail', label: 'Assigned user email', aliases: ['owner email', 'assigned user', 'assigned user email'] }
  ];
  const normalizeHeader = value => String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const exactTime = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const eventKind = value => {
    let title = String(value || '').toLowerCase();
    if (title.includes('whatsapp') || title.includes('message')) return 'message';
    if (title.includes('call')) return 'call';
    if (title.includes('email')) return 'email';
    if (title.includes('follow')) return 'followup';
    if (title.includes('meeting')) return 'meeting';
    return 'update';
  };

  /* New activity receives a durable timestamp; older entries remain clearly labelled as historical. */
  addTimeline = function (lead, title, detail) {
    if (!lead) return;
    let at = Date.now(), actor = currentUser?.() || account;
    lead.timeline = Array.isArray(lead.timeline) ? lead.timeline : [];
    lead.timeline.unshift({ title, detail, at, when: exactTime(at), actor: actor?.name || actor?.email || 'CRM user', kind: eventKind(title) });
  };
  renderCompleteLeadTimeline = function (lead) {
    let history = completeLeadTimeline(lead), heading = $('#clientTimeline').closest('.panel')?.querySelector('.toolbar h2');
    if (heading) heading.innerHTML = `Timeline <span class="timeline-count">${history.length}</span>`;
    $('#clientTimeline').innerHTML = history.map(item => {
      let kind = item.kind || eventKind(item.title), important = kind !== 'update', timestamp = item.at ? exactTime(item.at) : (item.when && item.when !== 'Just now' ? item.when : 'Earlier activity · exact time unavailable');
      return `<article class="timeline-item timeline-${kind} ${important ? 'timeline-important' : ''}"><b>${safe(item.title || 'Activity')}</b><div class="timeline-detail">${safe(item.detail || 'No additional details')}</div><div class="when">${safe(timestamp)} · by ${safe(item.actor || account.name)}</div></article>`;
    }).join('');
  };
  const openLeadTimelineBase = openLead;
  openLead = function (index) {
    let result = openLeadTimelineBase(index), lead = leads[index], temperature = $('#drawerLeadStatusTop');
    if (temperature && !temperature.querySelector('option[value=""]')) temperature.insertAdjacentHTML('afterbegin', '<option value="">Choose temperature</option>');
    if (temperature && lead) { temperature.value = lead.temperature || ''; refreshEnhancedSelect(temperature); }
    configureLeadPage(lead);
    if (lead) renderCompleteLeadTimeline(lead);
    return result;
  };

  /* The lead command center is a full client page. Its first control is the
     actual pipeline stage, so stage and contact outcome cannot drift apart. */
  let leadPageScrollY = 0;
  const drawer = $('#drawer');
  const drawerPanels = [...drawer.children].filter(element => element.classList.contains('panel'));
  ['lead-summary-panel', 'lead-followup-panel', 'lead-info-panel', 'lead-notes-panel', 'lead-timeline-panel'].forEach((className, index) => drawerPanels[index]?.classList.add(className));
  drawer.querySelector('.modalhead .eyebrow').textContent = 'Client workspace';
  const leadPageClose = drawer.querySelector('.modalhead .close');
  leadPageClose.classList.add('lead-page-close');
  leadPageClose.setAttribute('aria-label', 'Back to CRM');
  leadPageClose.textContent = '←';

  function syncLeadPageFrame() {
    let headerBottom = document.querySelector('.top')?.getBoundingClientRect().bottom || 66;
    drawer.style.setProperty('--lead-shell-top', `${Math.max(0, Math.round(headerBottom))}px`);
  }

  function setLeadPageScrollLock(open) {
    if (open && !document.body.classList.contains('lead-page-open')) {
      syncLeadPageFrame();
      leadPageScrollY = window.scrollY;
      document.body.style.top = `-${leadPageScrollY}px`;
      document.body.classList.add('lead-page-open');
      requestAnimationFrame(syncLeadPageFrame);
    } else if (!open && document.body.classList.contains('lead-page-open')) {
      document.body.classList.remove('lead-page-open');
      document.body.style.top = '';
      window.scrollTo({ top: leadPageScrollY, behavior: 'instant' });
    }
  }
  new MutationObserver(() => setLeadPageScrollLock(drawer.classList.contains('open'))).observe(drawer, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => requestAnimationFrame(syncLeadPageFrame), { passive: true });
  document.querySelectorAll('.nav [data-page], .mobile [data-page]').forEach(button => button.addEventListener('click', () => {
    if (drawer.classList.contains('open')) closeLeadDrawer();
  }));

  function configureLeadPage(lead) {
    if (!lead) return;
    setLeadPageScrollLock(true);
    let stageSelect = $('#drawerStatus'), stageWrap = stageSelect.closest('.select-ui');
    let stageName = stages[lead.stage]?.[0] || stages[0]?.[0] || 'Not connected';
    stageSelect.setAttribute('aria-label', 'Pipeline stage');
    stageSelect.innerHTML = stages.map((stage, index) => `<option value="${index}">${safe(stage[0])}</option>`).join('');
    stageSelect.value = String(Math.max(0, lead.stage || 0));
    if (stageWrap && !stageWrap.parentElement.classList.contains('lead-page-control')) {
      let control = document.createElement('label');
      control.className = 'lead-page-control lead-stage-control';
      control.innerHTML = '<span>Pipeline stage</span>';
      stageWrap.parentNode.insertBefore(control, stageWrap);
      control.appendChild(stageWrap);
    }
    refreshEnhancedSelect(stageSelect);
    stageWrap?.querySelector('.pretty-select-trigger')?.setAttribute('title', `${lead.pipeline || pipelines[0]?.name || 'Pipeline'} · ${stageName}`);
    let temperatureSelect = $('#drawerLeadStatusTop'), temperatureWrap = temperatureSelect?.closest('.select-ui');
    if (temperatureWrap && !temperatureWrap.parentElement.classList.contains('lead-page-control')) {
      let control = document.createElement('label');
      control.className = 'lead-page-control lead-temperature-control';
      control.innerHTML = '<span>Lead temperature</span>';
      temperatureWrap.parentNode.insertBefore(control, temperatureWrap);
      control.appendChild(temperatureWrap);
    }
    $('#drawerMeta .lead-quality .score-badge')?.remove();
  }

  saveDrawerButton.onclick = () => {
    let lead = leads[currentLead];
    if (!lead) return;
    let nextStage = Math.max(0, Number($('#drawerStatus').value) || 0), stageName = stages[nextStage]?.[0], currentStage = Math.max(0, Number(lead.stage) || 0);
    let nextLeadStatus = $('#drawerLeadStatusTop').value, rawScore = $('#drawerFeasibility').value.trim();
    let nextScore = $('#drawerFeasibility').dataset.scoreMode === 'automatic' && !saveDrawerButton.classList.contains('score-edited') ? null : (rawScore === '' ? null : Math.max(0, Math.min(100, Number(rawScore) || 0)));
    if (stageName === 'Won' && stages[currentStage]?.[0] !== 'Won') return requestWonDetails(currentLead, nextStage, lead.pipeline, { source: 'drawer', temperature: nextLeadStatus, score: nextScore });
    if (stageName === 'Lost' && stages[currentStage]?.[0] !== 'Lost') {
      let reason = prompt('Why was this opportunity lost?');
      if (!reason?.trim()) return toast('Add a loss reason before moving the lead to Lost');
      lead.lostReason = reason.trim();
    }
    let changes = [];
    if (String(lead.temperature || '') !== nextLeadStatus) { changes.push(`Lead status: ${leadTemperature(lead)} → ${nextLeadStatus || 'Not set'}`); lead.temperature = nextLeadStatus; }
    if ((lead.score ?? null) !== nextScore) { changes.push(`Feasibility: ${lead.score ?? 'automatic'} → ${nextScore ?? 'automatic'}`); lead.score = nextScore; }
    if (currentStage !== nextStage) commitPipelineStage(currentLead, nextStage, lead.pipeline);
    if (changes.length) addTimeline(lead, 'Lead qualification updated', changes.join(' · '));
    if (currentStage === nextStage && !changes.length) return toast('No changes to save');
    feed.unshift(['Lead updated', lead.name, [currentStage !== nextStage ? `Pipeline: ${stages[currentStage]?.[0] || 'Unassigned'} → ${stageName}` : '', ...changes].filter(Boolean).join(' · '), exactTime(Date.now()), currentUser().email || currentUser().name]);
    saveState(); saveDrawerButton.classList.remove('has-changes', 'score-edited');
    renderLeads($('#leadSearch').value); renderBoard($('#boardSearch').value); renderToday(); renderActivities(); renderSalesPerformance(); openLead(currentLead); toast('Client changes saved');
  };
  drawer.addEventListener('input', event => { if (event.target.matches('#drawerFeasibility')) saveDrawerButton.classList.add('score-edited'); });
  leadTemperature = lead => {
    let value = String(lead?.temperature || '').trim().toLowerCase();
    return value === 'hot' ? 'Hot' : value === 'warm' ? 'Warm' : value === 'cold' ? 'Cold' : 'Not set';
  };
  const temperatureSelect = $('#leadForm [name="temperature"]');
  if (temperatureSelect && !temperatureSelect.querySelector('option[value=""]')) temperatureSelect.insertAdjacentHTML('afterbegin', '<option value="">Choose temperature</option>');
  if (temperatureSelect) { temperatureSelect.value = ''; refreshEnhancedSelect(temperatureSelect); }
  const resetTemperatureBase = resetLeadForm;
  resetLeadForm = function () { resetTemperatureBase(); let select = $('#leadForm [name="temperature"]'); select.value = ''; refreshEnhancedSelect(select); };
  let importRows = [], importFileName = '';
  let mappingModal = document.createElement('div');
  mappingModal.id = 'importMappingModal';
  mappingModal.className = 'modal import-mapping-modal';
  mappingModal.innerHTML = `<div class="modalhead"><div><div class="eyebrow">Spreadsheet import</div><h2 style="margin:2px 0 0">Map spreadsheet columns</h2></div><button class="close" type="button" data-import-close aria-label="Close">×</button></div><p class="muted" id="importMappingSummary"></p><div class="mapping-layout" id="importMappingFields"></div><div class="mapping-preview"><div class="mapping-preview-head"><b>Preview</b><span>First 3 data rows</span></div><div class="table-scroll"><table class="table"><thead id="importPreviewHead"></thead><tbody id="importPreviewBody"></tbody></table></div></div><div class="actions-end"><button class="btn" type="button" data-import-close>Cancel</button><button class="btn primary" type="button" id="confirmMappedImport">Import leads</button></div>`;
  document.body.appendChild(mappingModal);
  mappingModal.querySelectorAll('[data-import-close]').forEach(button => button.onclick = () => mappingModal.classList.remove('open'));

  function guessedIndex(headers, field) {
    let normalized = headers.map(normalizeHeader);
    return normalized.findIndex(header => field.aliases.some(alias => header === normalizeHeader(alias)));
  }
  function mappingSelection() {
    return Object.fromEntries([...mappingModal.querySelectorAll('[data-map-field]')].map(select => [select.dataset.mapField, Number(select.value)]));
  }
  function renderMappingPreview() {
    let mapping = mappingSelection(), columns = mappingFields.filter(field => mapping[field.key] >= 0);
    $('#importPreviewHead').innerHTML = `<tr>${columns.map(field => `<th>${safe(field.label)}</th>`).join('')}</tr>`;
    $('#importPreviewBody').innerHTML = importRows.slice(1, 4).map(row => `<tr>${columns.map(field => `<td>${safe(row[mapping[field.key]] ?? '')}</td>`).join('')}</tr>`).join('') || '<tr><td>No data rows found.</td></tr>';
    $('#confirmMappedImport').disabled = mapping.name < 0;
  }
  function openImportMapping(rows, fileName) {
    if (!Array.isArray(rows) || rows.length < 2) return toast('The spreadsheet needs a header row and at least one lead');
    importRows = rows.map(row => Array.isArray(row) ? row : []); importFileName = fileName;
    let headers = importRows[0].map(value => String(value || '').replace(/^\uFEFF/, '').trim());
    $('#importMappingSummary').textContent = `${fileName} · ${Math.max(0, importRows.length - 1)} data rows. Match each CRM field to a spreadsheet column before importing.`;
    $('#importMappingFields').innerHTML = mappingFields.map(field => {
      let guess = guessedIndex(headers, field);
      return `<label class="mapping-field"><span>${safe(field.label)}${field.required ? ' <em>Required</em>' : ''}</span><select data-map-field="${field.key}"><option value="-1">Do not import</option>${headers.map((header, index) => `<option value="${index}" ${index === guess ? 'selected' : ''}>${safe(header || `Column ${index + 1}`)}</option>`).join('')}</select></label>`;
    }).join('');
    mappingModal.classList.add('open');
    upgradeSelects(mappingModal);
    mappingModal.querySelectorAll('[data-map-field]').forEach(select => select.onchange = renderMappingPreview);
    renderMappingPreview();
  }
  function normalizeTemperature(value) {
    let normalized = String(value || '').trim().toLowerCase();
    return normalized === 'hot' ? 'Hot' : normalized === 'warm' ? 'Warm' : normalized === 'cold' ? 'Cold' : '';
  }
  function importMappedLeads(rows, mapping, fileName) {
    let imported = 0, actor = currentUser(), validStatuses = ['Uncontacted', 'Contacted', 'Qualified', 'Won', 'Lost', 'No decision'];
    rows.slice(1).forEach(values => {
      let get = key => mapping[key] >= 0 ? String(values[mapping[key]] ?? '').trim() : '', name = get('name');
      if (!name) return;
      let product = get('product'), productConfig = products.find(item => item.name.toLowerCase() === product.toLowerCase()), stageName = get('stage'), stage = stages.findIndex(item => item[0].toLowerCase() === stageName.toLowerCase()), ownerEmail = get('ownerEmail').toLowerCase(), owner = users.find(user => String(user.email || '').toLowerCase() === ownerEmail) || actor;
      let status = get('status'); if (!validStatuses.includes(status)) status = 'Uncontacted';
      let rawScore = get('score'), follow = get('due'), lead = { name, phone: get('phone'), whatsapp: get('whatsapp') || get('phone'), email: get('email'), company: get('company'), source: get('source') || sources[0] || 'Manual', product, status, temperature: normalizeTemperature(get('temperature')), score: rawScore === '' ? null : Math.max(0, Math.min(100, Number(rawScore) || 0)), value: Math.max(0, Number(String(get('value')).replace(/[^0-9.-]/g, '')) || 0), stage: stage < 0 ? 0 : stage, pipeline: get('pipeline') || productConfig?.pipeline || pipelines[0]?.name || '', due: follow || 'Not scheduled', followAt: '', group: get('group') || 'No group', notes: get('notes'), createdAt: Date.now(), timeline: [], owner: owner?.name || '', ownerEmail: owner?.email || '', assignedBy: 'Spreadsheet import' };
      ensureLeadNumber(lead); addTimeline(lead, 'Lead imported', `${fileName} · assigned to ${lead.owner || 'current user'}`); leads.push(lead); imported++;
    });
    return imported;
  }
  $('#confirmMappedImport').onclick = () => {
    let count = importMappedLeads(importRows, mappingSelection(), importFileName);
    if (!count) return toast('No rows with a mapped Full name were found');
    feed.unshift(['Import', `${count} leads`, `Imported from ${importFileName}`, exactTime(Date.now()), currentUser().email || currentUser().name]);
    mappingModal.classList.remove('open'); saveState(); renderLeads(); renderBoard(); renderActivities(); renderToday(); renderSalesPerformance(); toast(`${count} lead${count === 1 ? '' : 's'} imported`);
  };
  $('#csvInput').onchange = async event => {
    let file = event.target.files[0]; if (!file) return;
    try { openImportMapping(file.name.toLowerCase().endsWith('.xlsx') ? await parseXlsx(file) : parseCsvText(await file.text()), file.name); }
    catch (error) { console.error(error); toast(`Import failed: ${error.message}`); }
    finally { event.target.value = ''; }
  };

  function downloadImportTemplate() {
    let anchor = document.createElement('a'); anchor.href = '/assets/Nazoft_CRM_Import_Template.xlsx'; anchor.download = 'Nazoft_CRM_Import_Template.xlsx'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  }
  function exportAllDataXlsx() {
    if (!hasPermission('Export data')) return toast('Your role does not include exports');
    let sheets = typeof allLeadExportSheet === 'function' ? allLeadExportSheet() : buildReportSheets('full', 'week', '', true);
    downloadBlob(NazoftFileFormats.createXlsxWorkbook(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `Nazoft_CRM_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('CRM data exported as Excel');
  }

  let brandingButton = document.createElement('button');
  brandingButton.dataset.setting = 'branding'; brandingButton.textContent = 'Branding & reports';
  let dataButton = $('[data-setting="data"]'); dataButton?.parentNode.insertBefore(brandingButton, dataButton);
  brandingButton.onclick = () => selectSetting('branding');
  if (typeof applyAccess === 'function') applyAccess();
  let logoInput = document.createElement('input'); logoInput.type = 'file'; logoInput.id = 'companyLogoInput'; logoInput.accept = 'image/png,image/jpeg,image/webp'; logoInput.hidden = true; document.body.appendChild(logoInput);
  const settingsHtmlFilesBase = settingsHtml;
  settingsHtml = function (name) {
    if (name === 'data') return `<h2>Import & export</h2><p class="muted">Move leads with a guided mapping step, or export a real Excel workbook without compatibility warnings.</p><div class="data-action-grid"><button class="data-action-card" type="button" data-import-open>${uiIcon('upload')}<span><b>Import spreadsheet</b><small>CSV or XLSX · map columns before importing</small></span></button><button class="data-action-card" type="button" data-template-download>${uiIcon('document')}<span><b>Download mapping template</b><small>Ready-to-fill Excel template with instructions</small></span></button><button class="data-action-card" type="button" data-export-xlsx>${uiIcon('download')}<span><b>Export CRM data</b><small>Standards-compliant Excel workbook (.xlsx)</small></span></button></div><div class="import-hint"><b>Safe importing</b><br>The mapping preview lets you confirm every field. Empty rows are skipped, unknown assigned-user emails fall back to the current user, and lead numbering remains continuous across the workspace.</div>`;
    if (name === 'branding') { let logo = account.companyLogo; return `<h2>Branding & reports</h2><p class="muted">Add your company identity to management PDFs and client-facing report downloads.</p><div class="brand-report-card"><div class="company-logo-preview ${logo ? 'has-logo' : ''}">${logo ? `<img src="${safe(logo.dataUrl)}" alt="Company logo">` : `${uiIcon('image')}<span>No company logo</span>`}</div><div class="grow"><h3>${safe(account.company || 'Your company')}</h3><p class="muted">PNG, JPG, or WebP. The image is resized and stored securely with this CRM workspace.</p><div class="profile-photo-actions"><button class="btn primary" type="button" data-logo-upload>${logo ? 'Change logo' : 'Add logo'}</button>${logo ? '<button class="btn danger" type="button" data-logo-remove>Remove logo</button>' : ''}</div></div></div><div class="settings-note">PDF reports automatically use this logo. Excel exports remain clean, structured workbooks for filtering and analysis.</div>`; }
    return settingsHtmlFilesBase(name);
  };
  const renderConfigFilesBase = renderConfigSetting;
  renderConfigSetting = function (name = currentSetting) {
    renderConfigFilesBase(name); let pane = $('#settingsPane');
    if (name === 'data') { pane.querySelector('[data-import-open]')?.addEventListener('click', () => $('#csvInput').click()); pane.querySelector('[data-template-download]')?.addEventListener('click', downloadImportTemplate); pane.querySelector('[data-export-xlsx]')?.addEventListener('click', exportAllDataXlsx); }
    if (name === 'branding') { pane.querySelector('[data-logo-upload]')?.addEventListener('click', () => logoInput.click()); pane.querySelector('[data-logo-remove]')?.addEventListener('click', () => { account.companyLogo = null; saveState(); renderConfigSetting('branding'); toast('Company logo removed'); }); }
    enhanceIconography(pane);
  };
  logoInput.onchange = () => {
    let file = logoInput.files[0]; if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast('Choose a PNG, JPG, or WebP logo');
    if (file.size > 4 * 1024 * 1024) return toast('Logo must be smaller than 4 MB');
    let reader = new FileReader(); reader.onload = () => { let image = new Image(); image.onload = () => { let scale = Math.min(1, 480 / image.width, 180 / image.height), width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale)), canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; let context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height); account.companyLogo = { dataUrl: canvas.toDataURL('image/jpeg', .9), width, height, name: file.name }; saveState(); renderConfigSetting('branding'); toast('Company logo saved for PDF reports'); }; image.onerror = () => toast('This logo image could not be read'); image.src = reader.result; }; reader.readAsDataURL(file); logoInput.value = '';
  };

  function reportBranding() { return account.companyLogo ? { ...account.companyLogo, companyName: account.company || 'Nazoft CRM' } : null; }
  function downloadReportFile(sheets, title, base, format) {
    if (format === 'excel') downloadBlob(NazoftFileFormats.createXlsxWorkbook(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${base}.xlsx`);
    else downloadBlob(NazoftFileFormats.createPdfReport(sheets, title, reportBranding()), 'application/pdf', `${base}.pdf`);
  }
  [...document.querySelectorAll('#exportReportFormat option[value="excel"],#leadExportFormat option[value="excel"]')].forEach(option => option.textContent = 'Excel workbook (.xlsx)');
  $('#downloadReport').onclick = () => {
    let type = $('#exportReportType').value, period = type === 'daily' ? 'today' : $('#exportReportPeriod').value, user = $('#exportReportUser').value, format = $('#exportReportFormat').value, sheets = buildReportSheets(type, period, user, $('#exportDetails').checked), base = `Nazoft_${type}_${period}_${new Date().toISOString().slice(0, 10)}`;
    downloadReportFile(sheets, reportNames[type], base, format); reportExportModal.classList.remove('open'); toast(`${reportNames[type]} downloaded as ${format === 'excel' ? 'Excel' : 'PDF'}`);
  };
  $('#downloadLeads').onclick = () => {
    if (!hasPermission('Export data')) return toast('Your role does not include lead exports');
    let format = $('#leadExportFormat').value, name = `Nazoft_All_Leads_${new Date().toISOString().slice(0, 10)}`;
    downloadReportFile(allLeadExportSheet(), 'All Leads Report', name, format); leadExportModal.classList.remove('open'); toast(`All leads downloaded as ${format === 'excel' ? 'Excel' : 'PDF'}`);
  };
})();
