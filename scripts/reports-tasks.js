(() => {
  let tasks = Array.isArray(window.__NAZOFT_REMOTE_STATE__?.tasks) ? window.__NAZOFT_REMOTE_STATE__.tasks : [];
  const stateBase = currentWorkspaceState;
  currentWorkspaceState = () => ({ ...stateBase(), tasks });
  // Replace the bootstrap's pending save with the complete state, including tasks.
  if (window.__NAZOFT_AUTHENTICATED__) saveState();
  const me = () => String(currentUser().email || '').toLowerCase();
  const ownTasks = () => {
    const generated=CrmTaskHelpers.automaticTasks(leads,me());
    const active=new Set(generated.map(task=>task.id));
    return [...tasks.filter(task=>String(task.ownerEmail).toLowerCase()===me() && (!task.auto || task.completedAt || active.has(task.id))),...generated.filter(task=>!tasks.some(saved=>saved.id===task.id))];
  };
  const canEdit = () => hasPermission('Edit leads');
  const dateText = value => {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded';
    const region = accountPreferences.regional || {};
    return new Intl.DateTimeFormat(region.locale || undefined, { dateStyle:'medium', timeStyle:'short', ...(region.timeZone ? {timeZone:region.timeZone} : {}) }).format(new Date(value));
  };
  const money = value => new Intl.NumberFormat(accountPreferences.regional?.locale || undefined, {style:'currency',currency:accountPreferences.regional?.currency || 'SAR'}).format(Number(value)||0);
  const nav = document.querySelector('.nav');
  const reportsNav = nav.querySelector('[data-page="performance"]');
  reportsNav.querySelector('span').textContent = 'Reports';
  reportsNav.setAttribute('aria-label','Reports');
  reportsNav.title = 'Reports';
  const taskNav = document.createElement('button');
  taskNav.dataset.page = 'tasks';
  taskNav.innerHTML = `${uiIcon('check')}<span>Tasks</span>`;
  taskNav.setAttribute('aria-label','Tasks');
  nav.querySelector('[data-page="today"]').after(taskNav);
  taskNav.onclick = () => { closeLeadDrawer(); page('tasks'); renderTasks(); };
  const taskPage = document.createElement('section');
  taskPage.id = 'tasks'; taskPage.className = 'page';
  taskPage.innerHTML = '<div class="head"><div><div class="eyebrow">Your daily work</div><h1>Tasks</h1><p>Calls, meetings, follow-ups, and personal reminders.</p></div><button class="btn primary" id="createCrmTask">Add task</button></div><div class="crm-work-toolbar"><select id="taskScope" aria-label="Task view"><option value="pending">Pending</option><option value="today">Today</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="all">All tasks</option></select><input type="date" id="taskDay" aria-label="Filter by due or completion date"><button class="btn" id="clearTaskDay">Clear date</button></div><p class="muted">Reminders appear in CRM notifications while the app is open. Completed view filters by completion date.</p><div id="crmTaskList" class="panel"></div>';
  document.querySelector('.content').append(taskPage);
  const taskModal = document.createElement('div');
  taskModal.className = 'modal'; taskModal.id = 'crmTaskModal';
  taskModal.setAttribute('role','dialog');
  taskModal.setAttribute('aria-modal','true');
  taskModal.setAttribute('aria-label','Task');
  taskModal.innerHTML = '<div class="modalhead"><h2>Task</h2><button type="button" class="close" aria-label="Close task">×</button></div><form id="crmTaskForm"><input name="id" type="hidden"><div class="formgrid"><div class="field full"><label>Task title</label><input name="title" required maxlength="200"></div><div class="field"><label>Type</label><select name="kind"><option>Reminder</option><option>Call</option><option>Follow-up</option><option>Meeting</option></select></div><div class="field"><label>Due date and time</label><input name="dueAt" type="datetime-local" required></div><div class="field full"><label>Linked lead (optional)</label><select name="leadNumber"></select></div><div class="field full"><label>Details</label><textarea name="details" maxlength="3000"></textarea></div></div><div class="actions-end"><button class="btn primary" type="submit">Save task</button></div></form>';
  document.body.append(taskModal);
  taskModal.querySelector('.close').onclick = () => taskModal.classList.remove('open');
  const form = taskModal.querySelector('form');
  const suggestion=document.createElement('small');suggestion.className='muted';suggestion.setAttribute('aria-live','polite');form.elements.title.after(suggestion);
  let dateManual=false;
  form.elements.dueAt.addEventListener('change',()=>dateManual=true);
  form.elements.title.addEventListener('input',()=>{
    const detected=CrmTaskHelpers.parseTitle(form.elements.title.value);
    if(dateManual)return;
    if(detected.dueAt){form.elements.dueAt.value=detected.dueAt;refreshDateControl(form.elements.dueAt);form.elements.kind.value=detected.kind;refreshEnhancedSelect(form.elements.kind);suggestion.textContent=`Detected ${dateText(detected.dueAt)}${detected.past?' — this time has already passed today':''}. You can change it.`;}
    else {form.elements.dueAt.value='';refreshDateControl(form.elements.dueAt);suggestion.textContent='Try “meeting tomorrow at 12pm” or “call on Sunday at 12”.';}
  });
  form.querySelectorAll('.field').forEach(field => { const input=field.querySelector('input,select,textarea'); if(input){input.id=`crmTask-${input.name}`;field.querySelector('label').htmlFor=input.id;} });
  taskModal.addEventListener('keydown',event=>{if(event.key==='Escape')taskModal.classList.remove('open');});
  function editTask(task = {}) {
    if (!canEdit()) return toast('Your role cannot edit tasks');
    form.reset();
    dateManual=!!task.id;suggestion.textContent='';
    if(task.auto){const index=leads.findIndex(lead=>lead.leadNumber===task.leadNumber);if(index>=0)openLead(index);return;}
    form.elements.leadNumber.innerHTML = '<option value="">No linked lead</option>' + leads.filter(lead => String(lead.ownerEmail).toLowerCase() === me() && !lead.archived).map(lead => `<option value="${safe(lead.leadNumber)}">${safe(lead.name)} · ${safe(lead.leadNumber)}</option>`).join('');
    for (const key of ['id','title','kind','dueAt','leadNumber','details']) if (task[key]) form.elements[key].value = task[key];
    taskModal.classList.add('open'); upgradeSelects(taskModal);
  }
  taskPage.querySelector('#createCrmTask').onclick = () => editTask();
  form.onsubmit = event => {
    event.preventDefault(); if (!canEdit()) return;
    const data = Object.fromEntries(new FormData(form));
    if (!data.title.trim() || Number.isNaN(new Date(data.dueAt).getTime())) return;
    const existing = ownTasks().find(task => task.id === data.id);
    const record = {...existing,...data,id:existing?.id || crypto.randomUUID(),ownerEmail:me(),createdAt:existing?.createdAt || Date.now(),completedAt:existing?.completedAt || null,notifiedAt:null};
    if (existing) tasks[tasks.indexOf(existing)] = record; else tasks.push(record);
    saveState(); taskModal.classList.remove('open'); renderTasks(); toast('Task saved');
  };
  function renderTasks() {
    const scope = taskPage.querySelector('#taskScope').value, day = taskPage.querySelector('#taskDay').value;
    const today = new Date(); const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const localDay = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const list = ownTasks().filter(task => {
      const date = scope === 'completed' ? localDay(task.completedAt) : task.dueAt.slice(0,10);
      return (scope === 'all' || (scope === 'completed' ? task.completedAt : !task.completedAt)) && (scope !== 'today' || task.dueAt.slice(0,10) === todayKey) && (scope !== 'overdue' || new Date(task.dueAt) < today) && (!day || (date >= day && date <= taskRangeEnd));
    }).sort((a,b) => scope === 'completed' ? b.completedAt-a.completedAt : new Date(a.dueAt)-new Date(b.dueAt));
    taskPage.querySelector('#crmTaskList').innerHTML = list.map(task => `<article class="crm-task-row ${task.completedAt?'done':new Date(task.dueAt)<today?'overdue':''}"><input type="checkbox" aria-label="Complete ${safe(task.title)}" data-task-done="${safe(task.id)}" ${task.completedAt?'checked':''} ${canEdit()?'':'disabled'}><div class="task-copy"><b>${safe(task.title)}</b><small>${safe(task.kind)} · Due ${safe(dateText(task.dueAt))}</small>${task.details?`<small>${safe(task.details)}</small>`:''}${task.completedAt?`<small>Completed ${safe(dateText(task.completedAt))}</small>`:''}</div>${task.leadNumber?`<button class="btn small" data-task-lead="${safe(task.leadNumber)}">Open lead</button>`:''}<button class="btn small" data-task-edit="${safe(task.id)}">Edit</button></article>`).join('') || '<div class="crm-empty">No tasks in this view.</div>';
    taskPage.querySelectorAll('[data-task-done]').forEach(input => input.onchange = () => { if (!canEdit()) return; const task = ownTasks().find(item => item.id === input.dataset.taskDone); if(!tasks.some(saved=>saved.id===task.id))tasks.push(task);task.completedAt = input.checked ? Date.now() : null; saveState(); renderTasks(); });
    taskPage.querySelectorAll('[data-task-edit]').forEach(button => button.onclick = () => editTask(ownTasks().find(task => task.id === button.dataset.taskEdit)));
    taskPage.querySelectorAll('[data-task-lead]').forEach(button => button.onclick = () => { const index = leads.findIndex(lead => lead.leadNumber === button.dataset.taskLead); if(index>=0) openLead(index); else toast('This lead is no longer assigned to you'); });
  }
  taskPage.querySelector('#taskScope').onchange = renderTasks;
  let taskRangeEnd = '';
  const taskDay = taskPage.querySelector('#taskDay');
  taskDay.type = 'hidden';
  const taskRange = document.createElement('button');
  taskRange.type = 'button'; taskRange.id = 'taskDateRange'; taskRange.className = 'btn';
  taskRange.setAttribute('aria-haspopup','dialog'); taskRange.setAttribute('aria-expanded','false');
  taskDay.after(taskRange);
  function setTaskRange(start = '', end = '') {
    taskDay.value = start; taskRangeEnd = end || start;
    const label = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'2-digit',year:'numeric'});
    taskRange.innerHTML = `${uiIcon('calendar')}<span>${start ? `${label(start)} – ${label(taskRangeEnd)}` : 'Choose date range'}</span><span aria-hidden="true">⌄</span>`;
    renderTasks();
  }
  taskPage.querySelector('#clearTaskDay').onclick = () => setTaskRange();
  taskRange.onclick = () => {
    const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const today = new Date();
    let start = taskDay.value, end = taskRangeEnd, choosingEnd = false;
    let month = start ? new Date(`${start}T12:00:00`) : new Date(); month.setDate(1);
    const picker = document.createElement('div'); picker.className = 'task-range-picker';
    picker.id = 'taskRangePicker'; picker.setAttribute('popover','auto'); picker.setAttribute('role','dialog');
    picker.setAttribute('aria-label','Choose task date range');
    picker.innerHTML = '<aside class="task-range-presets"><strong>Quick Select</strong></aside><div class="task-range-main"><div class="task-range-months"></div><div class="task-range-footer"><span aria-live="polite"></span><button type="button" class="btn" data-clear>Clear</button><button type="button" class="btn primary" data-apply>Apply</button></div></div>';
    const presets = ['Today','Yesterday','Last 7 Days','Last 30 Days','This Month','Last Month'];
    presets.forEach((label,index) => {
      const button = document.createElement('button'); button.type='button'; button.textContent=label;
      button.onclick = () => {
        let from = new Date(today), to = new Date(today);
        if(index===1){from.setDate(from.getDate()-1);to=new Date(from);}
        if(index===2 || index===3)from.setDate(from.getDate()-(index===2?6:29));
        if(index===4){from.setDate(1);to=new Date(today.getFullYear(),today.getMonth()+1,0);}
        if(index===5){from=new Date(today.getFullYear(),today.getMonth()-1,1);to=new Date(today.getFullYear(),today.getMonth(),0);}
        start=key(from);end=key(to);choosingEnd=false;month=new Date(from.getFullYear(),from.getMonth(),1);
        picker.querySelectorAll('.task-range-presets button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));draw();
      };
      picker.querySelector('aside').append(button);
    });
    function position() {
      const rect=taskRange.getBoundingClientRect();
      picker.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-picker.offsetWidth-8))}px`;
      picker.style.top=`${Math.max(8,Math.min(rect.bottom+6,innerHeight-picker.offsetHeight-8))}px`;
    }
    function draw() {
      const months=picker.querySelector('.task-range-months'); months.replaceChildren();
      for(let offset=0;offset<2;offset++){
        const date=new Date(month.getFullYear(),month.getMonth()+offset,1);
        const section=document.createElement('section'); section.className='task-range-month';
        section.innerHTML='<div class="task-range-heading pretty-select"><button type="button" class="btn"></button><select aria-label="Calendar month"></select><select aria-label="Calendar year"></select></div><div class="task-range-grid"></div>';
        const arrow=section.querySelector('button');arrow.textContent=offset?'›':'‹';arrow.setAttribute('aria-label',offset?'Next month':'Previous month');
        arrow.onclick=()=>{month.setMonth(month.getMonth()+(offset?1:-1));draw();};
        const [monthSelect,yearSelect]=section.querySelectorAll('select');
        for(let m=0;m<12;m++)monthSelect.add(new Option(new Date(2026,m,1).toLocaleDateString(undefined,{month:'long'}),String(m)));
        for(let y=Math.min(today.getFullYear()-100,date.getFullYear());y<=Math.max(today.getFullYear()+50,date.getFullYear());y++)yearSelect.add(new Option(String(y),String(y)));
        monthSelect.value=date.getMonth();yearSelect.value=date.getFullYear();
        const change=()=>{month=new Date(Number(yearSelect.value),Number(monthSelect.value)-offset,1);draw();};monthSelect.onchange=change;yearSelect.onchange=change;
        const grid=section.querySelector('.task-range-grid');
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(day=>{const label=document.createElement('span');label.textContent=day;grid.append(label);});
        for(let i=0;i<42;i++){
          const day=new Date(date.getFullYear(),date.getMonth(),i-date.getDay()+1), value=key(day);
          const button=document.createElement('button');button.type='button';button.textContent=day.getDate();button.dataset.date=value;
          button.className=[day.getMonth()!==date.getMonth()?'outside':'',start&&value>=start&&value<=(end||start)?'in-range':'',value===start||value===end?'endpoint':''].join(' ');
          button.setAttribute('aria-label',day.toLocaleDateString(undefined,{dateStyle:'full'}));button.setAttribute('aria-pressed',String(value===start||value===end));
          if(value===key(today))button.setAttribute('aria-current','date');
          button.onclick=()=>{if(!choosingEnd){start=value;end='';choosingEnd=true;}else{end=value;if(end<start)[start,end]=[end,start];choosingEnd=false;}picker.querySelectorAll('aside button').forEach(item=>item.setAttribute('aria-pressed','false'));draw();picker.querySelector(`[data-date="${value}"]`)?.focus();};grid.append(button);
        }
        months.append(section);
      }
      picker.querySelector('.task-range-footer span').textContent=choosingEnd?'Choose end date, or Apply for one day.':'Choose a start and end date.';
      if(picker.matches(':popover-open'))position();
    }
    const close=()=>{picker.hidePopover();taskRange.focus();};
    picker.querySelector('[data-clear]').onclick=()=>{setTaskRange();close();};
    picker.querySelector('[data-apply]').onclick=()=>{setTaskRange(start,end);close();};
    picker.addEventListener('toggle',event=>{if(event.newState==='closed'){picker.remove();taskRange.setAttribute('aria-expanded','false');window.removeEventListener('resize',position);}});
    document.body.append(picker);draw();picker.showPopover();position();taskRange.setAttribute('aria-expanded','true');
    picker.querySelector('aside button').focus();window.addEventListener('resize',position);
  };
  setTaskRange();
  function remindTasks() {
    let changed=false;
    for(const task of ownTasks()) if(!task.completedAt && !task.notifiedAt && new Date(task.dueAt).getTime()<=Date.now()) {
      window.notifyCrmTask?.(`Task due · ${task.title}`,`${task.kind} · ${dateText(task.dueAt)}`);
      if(!tasks.some(saved=>saved.id===task.id))tasks.push(task);
      task.notifiedAt=Date.now(); changed=true;
    }
    if(changed && canEdit()) saveState();
  }
  setInterval(()=>{remindTasks();if(taskPage.classList.contains('active'))renderTasks();},30000); remindTasks(); renderTasks();

  const reports = document.querySelector('#performance');
  reports.querySelector('h1').textContent = 'Reports';
  const existing = document.createElement('div');
  [...reports.children].filter(element=>!element.classList.contains('head')).forEach(element=>existing.append(element));
  const tabs = document.createElement('div'); tabs.className='crm-report-tabs';
  tabs.innerHTML = ['Performance','Activity summary','Won clients','Lost clients','Open pipeline','Follow-ups'].map((name,index)=>`<button class="btn ${index===0?'active':''}" data-report-view="${safe(name)}">${safe(name)}</button>`).join('');
  const detail = document.createElement('div');
  detail.innerHTML='<div class="crm-work-toolbar"><input type="hidden" id="reportFrom"><input type="hidden" id="reportTo"><button type="button" class="btn" id="reportRange" aria-haspopup="dialog">Choose dates</button><button class="btn" id="downloadOutcomeReport">Download Excel</button></div><p class="muted">Filters use close dates for won deals, recorded loss dates for lost deals, next action dates for follow-ups, and creation dates for open leads. Undated records appear without a date filter.</p><div class="crm-report-list" id="outcomeRows"></div>';
  detail.hidden=true; reports.append(tabs,existing,detail);
  const presets=document.createElement('div');presets.className='crm-work-toolbar';presets.innerHTML='<button class="btn" data-period="today">Today</button><button class="btn" data-period="month">This month</button><button class="btn" data-period="all">All dates</button>';detail.prepend(presets);
  presets.querySelectorAll('button').forEach(button=>button.onclick=()=>{const now=new Date();setRange(button.dataset.period==='all'?'':localDay(button.dataset.period==='month'?new Date(now.getFullYear(),now.getMonth(),1):now),button.dataset.period==='all'?'':localDay(now));});
  const localDay=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const rangeButton=detail.querySelector('#reportRange');
  const labelDay=value=>new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
  function setRange(from,to) {
    detail.querySelector('#reportFrom').value=from;detail.querySelector('#reportTo').value=to;
    rangeButton.textContent=from?(from===to?labelDay(from):`${labelDay(from)} – ${labelDay(to)}`):'Choose dates';
    renderReport();
  }
  rangeButton.onclick=()=>{
    let start=detail.querySelector('#reportFrom').value,end=detail.querySelector('#reportTo').value,selectingEnd=false;
    const initial=start?new Date(`${start}T12:00:00`):new Date();
    let month=new Date(initial.getFullYear(),initial.getMonth(),1);
    const dialog=document.createElement('dialog');dialog.className='report-range-dialog task-calendar-surface';dialog.setAttribute('aria-label','Choose report date range');
    dialog.innerHTML='<aside class="report-calendar-presets"></aside><div class="report-range-main"><div class="report-calendar-months"></div><div class="report-range-footer"><span class="report-range-help" aria-live="polite"></span><button type="button" class="btn" data-clear>Clear</button><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-apply>Apply</button></div></div>';
    const quick=dialog.querySelector('.report-calendar-presets');
    [['Today',0],['Yesterday',1],['Last 7 Days',6],['Last 30 Days',29],['This Month','month'],['Last Month','last-month']].forEach(([label,days])=>{
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.onclick=()=>{let to=new Date(),from=new Date();if(days==='month'){from=new Date(to.getFullYear(),to.getMonth(),1);to=new Date(to.getFullYear(),to.getMonth()+1,0);}else if(days==='last-month'){from=new Date(to.getFullYear(),to.getMonth()-1,1);to=new Date(to.getFullYear(),to.getMonth(),0);}else{from.setDate(from.getDate()-Number(days));if(label==='Yesterday')to.setDate(to.getDate()-1);}start=localDay(from);end=localDay(to);month=new Date(from.getFullYear(),from.getMonth(),1);selectingEnd=false;quick.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));draw();};quick.append(button);
    });
    function draw(){
      dialog.querySelector('.report-range-help').textContent=selectingEnd?'Click the end date, or Apply for a single day.':'Click a start date, then an end date.';
      dialog.querySelector('[data-apply]').disabled=!start;
      const months=dialog.querySelector('.report-calendar-months');months.replaceChildren();
      for(let offset=0;offset<2;offset++){
        const visible=new Date(month.getFullYear(),month.getMonth()+offset,1),section=document.createElement('section');section.className='report-calendar-month';
        section.innerHTML=`<div class="report-calendar-head"><button type="button" class="btn" aria-label="${offset?'Next':'Previous'} month">${offset?'›':'‹'}</button><strong>${visible.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong></div><div class="report-calendar-grid"></div>`;
        section.querySelector('.report-calendar-head button').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+(offset?1:-1),1);draw();};
        const grid=section.querySelector('.report-calendar-grid');
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(day=>{const text=document.createElement('span');text.textContent=day;grid.append(text);});
        for(let index=0;index<42;index++){
          const day=new Date(visible.getFullYear(),visible.getMonth(),index-visible.getDay()+1),value=localDay(day),button=document.createElement('button');
          button.type='button';button.textContent=day.getDate();button.setAttribute('aria-label',day.toLocaleDateString(undefined,{dateStyle:'full'}));
          button.className=[day.getMonth()!==visible.getMonth()?'outside':'',start&&value>=start&&value<=(end||start)?'in-range':'',value===start||value===end?'endpoint':''].join(' ');
          if(value===localDay(new Date()))button.setAttribute('aria-current','date');button.setAttribute('aria-pressed',String(value===start||value===end));
          button.onclick=()=>{if(!selectingEnd){start=value;end='';selectingEnd=true;}else{end=value;[start,end]=[start,end].sort();selectingEnd=false;}quick.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed','false'));draw();dialog.querySelector(`[data-focus-date="${value}"]`)?.focus();};
          button.dataset.focusDate=value;grid.append(button);
        }
        months.append(section);
      }
    }
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-clear]').onclick=()=>{setRange('','');dialog.close();};
    dialog.querySelector('[data-apply]').onclick=()=>{if(start)setRange(start,end||start);dialog.close();};
    dialog.onclose=()=>{dialog.remove();rangeButton.focus();};
    document.body.appendChild(dialog);draw();dialog.showModal();
  };
  let view='Performance', reportRows=[];
  function renderReport() {
    const from=detail.querySelector('#reportFrom').value,to=detail.querySelector('#reportTo').value;
    detail.querySelector('p.muted').textContent=view==='Activity summary'?'Counts use dated lead history. Lead metrics count distinct leads; calls and completed follow-ups count events. Meetings must be recorded as completed, not merely scheduled. Missing historical events cannot be inferred.':'Select a date range. Won clients use close dates; lost clients include recorded loss reasons and dates. Open pipeline uses creation dates; follow-ups use their scheduled dates.';
    if(from&&to&&from>to){reportRows=[];detail.querySelector('#outcomeRows').textContent='From date must be before or equal to To date.';return;}
    let scope=leads.filter(lead=>!lead.archived || ['Won','Lost'].includes(lead.status));
    if(view==='Won clients')scope=scope.filter(lead=>lead.status==='Won');
    if(view==='Lost clients'||view==='Loss reasons')scope=scope.filter(lead=>lead.status==='Lost');
    if(view==='Open pipeline')scope=scope.filter(lead=>!['Won','Lost'].includes(lead.status));
    if(view==='Follow-ups')scope=scope.filter(lead=>lead.followAt);
    const recordDate=lead=> view==='Follow-ups'?lead.followAt:lead.status==='Won'?lead.closedAt:lead.status==='Lost'?(lead.lostAt || lead.timeline?.find(item=>/lost/i.test(item.title+' '+item.detail))?.at):lead.createdAt;
    scope=scope.filter(lead=>{if(!from&&!to)return true;const value=recordDate(lead);if(!value || Number.isNaN(new Date(value).getTime()))return false;const day=localDay(new Date(value));return(!from||day>=from)&&(!to||day<=to);});
    reportRows=[['Client','Lead number','Client code','Outcome','Value','Date','Pipeline','Source','Assigned to','Loss details'],...scope.map(lead=>[lead.name,lead.leadNumber,lead.clientCode||'—',lead.status,money(lead.status==='Won'?lead.closedValue??lead.value:lead.value),dateText(recordDate(lead)),lead.pipeline,lead.source||'—',lead.ownerEmail||'Unassigned',lead.status==='Lost'?(lead.lostReason||'Not recorded'):'—'])];
    if(view==='Loss reasons') {const counts=new Map();scope.forEach(lead=>{const reason=lead.lostReason||'Not recorded';counts.set(reason,(counts.get(reason)||0)+1);});reportRows=[['Loss reason','Clients'],...counts.entries()];}
    if(view==='Activity summary')reportRows=CrmTaskHelpers.activityRows(leads,from,to);
    detail.querySelector('#outcomeRows').innerHTML=`<table><thead><tr>${reportRows[0].map(cell=>`<th>${safe(cell)}</th>`).join('')}</tr></thead><tbody>${reportRows.slice(1).map(row=>`<tr>${row.map(cell=>`<td>${safe(cell??'')}</td>`).join('')}</tr>`).join('')}</tbody></table>${reportRows.length===1?'<div class="crm-empty">No matching records.</div>':''}`;
  }
  tabs.querySelectorAll('button').forEach(button=>button.onclick=()=>{view=button.dataset.reportView;tabs.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));existing.hidden=view!=='Performance';reports.querySelector('.head .actions').style.display=view==='Performance'?'':'none';detail.hidden=view==='Performance';if(!detail.hidden)renderReport();});
  detail.querySelectorAll('input').forEach(input=>input.onchange=renderReport);
  detail.querySelector('#downloadOutcomeReport').onclick=()=>{if(!hasPermission('Export data'))return toast('Your role cannot export reports');renderReport();downloadBlob(NazoftFileFormats.createXlsxWorkbook([{name:view,rows:reportRows.map((cells,index)=>({kind:index?'data':'header',cells}))}]),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','CRM-report.xlsx');};
})();
