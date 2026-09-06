(() => {
  let rules = Array.isArray(window.__NAZOFT_REMOTE_STATE__?.assignmentRules) ? window.__NAZOFT_REMOTE_STATE__.assignmentRules : [];
  const stateBase = currentWorkspaceState;
  currentWorkspaceState = () => ({...stateBase(), assignmentRules:rules});
  if(window.__NAZOFT_AUTHENTICATED__) saveState();
  const renderBase = renderConfigSetting;
  renderConfigSetting = function(name = currentSetting) {
    renderBase(name);
    if(name !== 'meta') return;
    const section = document.createElement('section');
    section.className = 'preference-section';
    section.innerHTML = '<h3>Campaign assignment rules</h3><p class="muted">Route new Meta leads by campaign name. For example, “Nasin” can route to Nasin, or “Riyadh” to your branch manager. Matching ignores letter case; the first matching rule wins. Existing leads are not reassigned. Campaign attribution must be supplied by your lead integration.</p><div id="routingRules"></div><button class="btn" type="button" id="addRoutingRule">Add rule</button> <button class="btn primary" type="button" id="saveRoutingRules">Save assignment rules</button><p role="status" id="routingStatus"></p>';
    document.querySelector('#settingsPane .setting-view.active').append(section);
    const admin = window.__NAZOFT_MEMBERSHIP__?.role === 'admin' || (currentUser().role || '').toLowerCase() === 'administrator' || (currentUser().role || '').toLowerCase() === 'admin';
    const activeUsers = users.filter(user => user.email && !/suspended|viewer/i.test(`${user.status} ${user.role}`));
    let draft = structuredClone(rules);
    function collect() {
      draft = [...section.querySelectorAll('.routing-rule')].map(row => ({keyword:row.querySelector('input').value.trim(),ownerEmail:row.querySelector('select').value,enabled:true}));
    }
    function draw() {
      section.querySelector('#routingRules').innerHTML = draft.map((rule,index) => `<div class="routing-rule"><label>Campaign contains<input maxlength="100" value="${safe(rule.keyword || '')}" ${admin?'':'disabled'}></label><label>Assign to<select ${admin?'':'disabled'}><option value="">Choose user</option>${activeUsers.map(user=>`<option value="${safe(user.email)}" ${user.email===rule.ownerEmail?'selected':''}>${safe(user.name || user.email)}</option>`).join('')}</select></label><button type="button" class="btn danger" data-remove-rule="${index}" ${admin?'':'disabled'}>Remove</button></div>`).join('') || '<p class="muted">No campaign rules. Normal assignment is unchanged.</p>';
      section.querySelectorAll('[data-remove-rule]').forEach(button=>button.onclick=()=>{collect();draft.splice(Number(button.dataset.removeRule),1);draw();});
    }
    section.querySelector('#addRoutingRule').disabled = !admin;
    section.querySelector('#saveRoutingRules').disabled = !admin;
    section.querySelector('#addRoutingRule').onclick = () => {collect();draft.push({keyword:'',ownerEmail:''});draw();};
    section.querySelector('#saveRoutingRules').onclick = () => {
      if(!admin)return;
      collect();
      if(draft.some(rule=>!rule.keyword || !activeUsers.some(user=>user.email===rule.ownerEmail))) {
        section.querySelector('#routingStatus').textContent='Enter a keyword and choose an active user for every rule.';return;
      }
      rules=draft;saveState();section.querySelector('#routingStatus').textContent='Rules updated. The workspace save indicator confirms synchronization.';
    };
    draw();
  };
  // Custom-field switches reflect visibility, not deletion. Keep their state accessible.
  function syncSwitches() {
    document.querySelectorAll('button.switch-button').forEach(button=>{
      const checked=String(!!button.querySelector('.switch.on'));
      if(button.getAttribute('aria-pressed')!==checked)button.setAttribute('aria-pressed',checked);
      button.type='button';
    });
  }
  new MutationObserver(syncSwitches).observe(document.querySelector('#settingsPane'),{childList:true,subtree:true});
  syncSwitches();

  // Reserve the expressive FlowButton treatment for primary actions. Secondary,
  // contextual and menu controls use quiet colour feedback without moving.
  const specializedButtons = '.nav,.tabs,.crm-report-tabs,.pretty-select,.theme-options,.date-picker-head,.date-grid,.date-quick,.report-calendar-head,.report-calendar-grid,.report-calendar-presets,.task-range-heading,.task-range-grid,.task-range-presets';
  function syncFlowButtons(root) {
    if (!root) return;
    const buttons=[...(root.querySelectorAll?.('button.btn') || [])];
    if(root.matches?.('button.btn'))buttons.push(root);
    buttons.forEach(button=>{
      const majorAction=button.classList.contains('primary') || button.matches('#quickActivity,.top-actions .addLead');
      const contextual=button.closest('#leadMenu,.lead-followup-panel,#clientInfo,.crm-report-tabs,.report-tabs');
      const eligible=majorAction && !contextual && !!button.textContent.trim() && !button.closest(specializedButtons) && !button.matches('.close,.switch-button,.sidebar-toggle,.notification-button,.icon-button,.profile-settings,[aria-haspopup],[role="tab"],[role="switch"],[aria-label*="month"],#reportRange,#taskDateRange') && !/^[\d\s×✕‹›←→+−⋯.]+$/.test(button.textContent.trim());
      button.classList.toggle('crm-flow-button',eligible);
    });
  }
  syncFlowButtons(document);
  new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData')syncFlowButtons(record.target.parentElement?.closest('button') || record.target.parentElement);
      else {syncFlowButtons(record.target);for(const node of record.addedNodes)if(node.nodeType===1)syncFlowButtons(node);}
    }
  }).observe(document.body,{childList:true,subtree:true,characterData:true});

  // Shared native calendar adapter: preserve the CRM's input and time handling.
  const renderCalendarBase = renderDatePicker;
  renderDatePicker = function() {
    renderCalendarBase();
    if (!activeDateInput || activeDateInput.type === 'time') return;
    const quick = datePicker.querySelector('.date-quick');
    const scheduling = activeDateInput.type === 'datetime-local';
    if(scheduling) datePicker.querySelectorAll('[data-date-day],[data-date-nav]').forEach(button=>{
      const action=button.onclick;
      button.onclick=event=>{
        const hour=Number(datePicker.querySelector('#dateHour').value)%12+(datePicker.querySelector('#datePeriod').value==='PM'?12:0);
        datePickerDraft.setHours(hour,Number(datePicker.querySelector('#dateMinute').value),0,0);
        action(event);
      };
    });
    const choices = scheduling
      ? [['Today',0],['Tomorrow',1],['Next week',7],['Yesterday',-1],['Last week',-7]]
      : [['Today',0],['Yesterday',-1],['Last week',-7],['Last month','month'],['Last year','year']];
    quick.innerHTML = choices.map(([label,offset])=>`<button type="button" data-calendar-preset="${offset}">${label}</button>`).join('');
    quick.setAttribute('aria-label','Quick date selection');
    quick.querySelectorAll('button').forEach(button=>button.onclick=()=>{
      const value=button.dataset.calendarPreset;
      const next=new Date();
      if(value==='month'||value==='year') {
        const day=next.getDate();next.setDate(1);
        if(value==='month')next.setMonth(next.getMonth()-1);else next.setFullYear(next.getFullYear()-1);
        next.setDate(Math.min(day,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));
      } else next.setDate(next.getDate()+Number(value));
      // Changing a date must not reset a time already selected in this popup.
      if(scheduling){const hour=Number(datePicker.querySelector('#dateHour').value)%12+(datePicker.querySelector('#datePeriod').value==='PM'?12:0);next.setHours(hour,Number(datePicker.querySelector('#dateMinute').value),0,0);}
      datePickerDraft=next;datePickerView=new Date(next.getFullYear(),next.getMonth(),1);renderDatePicker();
    });
    datePicker.querySelectorAll('[data-date-day]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.classList.contains('selected')));
      if(button.classList.contains('today'))button.setAttribute('aria-current','date');
    });
    // Every single-date calendar uses the same two-month surface as the Tasks range picker.
    const primary=datePicker.querySelector('.date-picker-calendar');
    const chooseNativeDay=value=>{if(scheduling){const hour=Number(datePicker.querySelector('#dateHour').value)%12+(datePicker.querySelector('#datePeriod').value==='PM'?12:0);datePickerDraft.setHours(hour,Number(datePicker.querySelector('#dateMinute').value),0,0);}const [year,month,day]=value.split('-').map(Number);datePickerDraft.setFullYear(year,month-1,day);datePickerView=new Date(year,month-1,1);renderDatePicker();};
    // Tasks starts weeks on Sunday, so normalize the original single-date month too.
    const primaryFirst=new Date(datePickerView.getFullYear(),datePickerView.getMonth(),1),primaryStart=new Date(primaryFirst.getFullYear(),primaryFirst.getMonth(),1-primaryFirst.getDay()),primarySelected=localDateParts(datePickerDraft),primaryToday=localDateParts(new Date());
    primary.querySelector('.date-weekdays').innerHTML=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('');
    primary.querySelector('.date-grid').innerHTML=Array.from({length:42},(_,index)=>{const date=new Date(primaryStart);date.setDate(primaryStart.getDate()+index);const p=localDateParts(date),isSelected=p.year===primarySelected.year&&p.month===primarySelected.month&&p.day===primarySelected.day,isToday=p.year===primaryToday.year&&p.month===primaryToday.month&&p.day===primaryToday.day;return `<button type="button" class="date-day ${date.getMonth()!==datePickerView.getMonth()?'outside':''} ${isSelected?'selected':''} ${isToday?'today':''}" data-primary-day="${p.year}-${padDatePart(p.month)}-${padDatePart(p.day)}" aria-label="${date.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}" aria-pressed="${isSelected}" ${isToday?'aria-current="date"':''}>${p.day}</button>`}).join('');
    primary.querySelectorAll('[data-primary-day]').forEach(button=>button.onclick=()=>chooseNativeDay(button.dataset.primaryDay));
    primary.classList.add('crm-date-month','task-range-month');
    const months=document.createElement('div');months.className='crm-date-months task-range-months';
    primary.before(months);months.append(primary);
    const secondaryView=new Date(datePickerView.getFullYear(),datePickerView.getMonth()+1,1);
    const secondary=document.createElement('section');secondary.className='date-picker-calendar crm-date-month task-range-month crm-date-month-secondary';
    const selected=localDateParts(datePickerDraft),today=localDateParts(new Date()),first=new Date(secondaryView.getFullYear(),secondaryView.getMonth(),1),gridStart=new Date(first.getFullYear(),first.getMonth(),1-first.getDay());
    secondary.innerHTML=`<div class="date-picker-head"><div class="date-picker-title"><strong>${secondaryView.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong></div><button class="date-nav" type="button" data-secondary-next aria-label="Next month">›</button></div><div class="date-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="date-grid">${Array.from({length:42},(_,index)=>{const date=new Date(gridStart);date.setDate(gridStart.getDate()+index);const p=localDateParts(date),isSelected=p.year===selected.year&&p.month===selected.month&&p.day===selected.day,isToday=p.year===today.year&&p.month===today.month&&p.day===today.day;return `<button type="button" class="date-day ${date.getMonth()!==secondaryView.getMonth()?'outside':''} ${isSelected?'selected':''} ${isToday?'today':''}" data-secondary-day="${p.year}-${padDatePart(p.month)}-${padDatePart(p.day)}" aria-label="${date.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}" aria-pressed="${isSelected}" ${isToday?'aria-current="date"':''}>${p.day}</button>`}).join('')}</div>`;
    months.append(secondary);
    secondary.querySelector('[data-secondary-next]').onclick=()=>{datePickerView.setMonth(datePickerView.getMonth()+1);renderDatePicker();};
    secondary.querySelectorAll('[data-secondary-day]').forEach(button=>button.onclick=()=>chooseNativeDay(button.dataset.secondaryDay));
  };
  positionDatePicker = function(trigger) {
    const rect=trigger.getBoundingClientRect();
    const width=Math.min(activeDateInput?.type==='time'?322:748,innerWidth-24);
    datePicker.style.width=`${width}px`;
    datePicker.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`;
    datePicker.style.top='12px';
    const height=datePicker.offsetHeight;
    datePicker.style.top=`${Math.max(12,Math.min(rect.bottom+8,innerHeight-height-12))}px`;
  };
})();
