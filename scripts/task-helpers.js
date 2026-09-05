(function(root) {
  const localValue = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  function parseTitle(text, now = new Date()) {
    const value=text.toLowerCase(), date=new Date(now);
    const kind=/\bmeeting\b/.test(value)?'Meeting':/\bcall\b/.test(value)?'Call':/\bfollow[ -]?up\b/.test(value)?'Follow-up':'Reminder';
    const match=value.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || value.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
    if(!match)return {kind};
    let hour=Number(match[1]),minute=Number(match[2]||0);
    if(minute>59 || hour>23 || (match[3]&&(hour<1||hour>12)))return {kind};
    if(match[3])hour=hour%12+(match[3]==='pm'?12:0);
    date.setHours(hour,minute,0,0);
    if(/\btomorrow\b/.test(value))date.setDate(date.getDate()+1);
    else {
      const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const day=days.findIndex(day=>new RegExp(`\\b${day}\\b`).test(value));
      if(day>=0)date.setDate(date.getDate()+((day-date.getDay()+7)%7 || 7));
    }
    return {kind,dueAt:localValue(date),past:date<now};
  }
  function automaticTasks(leads, ownerEmail) {
    const result=[];
    for(const lead of leads) {
      if(String(lead.ownerEmail||'').toLowerCase()!==ownerEmail.toLowerCase() || lead.archived || ['Won','Lost'].includes(lead.status) || !lead.leadNumber)continue;
      const add=(kind,title,dueAt,key)=>{if(!dueAt || Number.isNaN(new Date(dueAt).getTime()))return;result.push({id:`auto:${ownerEmail}:${lead.leadNumber}:${key}`,auto:true,title,kind,dueAt:localValue(new Date(dueAt)),leadNumber:lead.leadNumber,ownerEmail,createdAt:lead.createdAt||Date.now(),completedAt:null,notifiedAt:null});};
      if(lead.followAt)add('Follow-up',`Follow up · ${lead.name}`,lead.followAt,`follow:${lead.followAt}`);
      if(lead.status==='Uncontacted')add('Call',`First call · ${lead.name}`,lead.assignedAt||lead.createdAt,`call:${lead.assignedAt||lead.createdAt}`);
    }
    return result;
  }
  function activityRows(leads,from,to) {
    const counts={'Leads assigned / received':0,'Leads contacted':0,'Meetings completed':0,'Proposals sent':0,'Deals won':0,'Deals lost':0,'Calls logged':0,'Follow-ups completed':0};
    const within=value=>{if(!value||Number.isNaN(new Date(value).getTime()))return false;const day=localValue(new Date(value)).slice(0,10);return(!from||day>=from)&&(!to||day<=to);};
    for(const lead of leads) {
      const events=(lead.timeline||[]).filter(item=>within(item.at));
      const match=pattern=>events.some(item=>pattern.test(`${item.title||''} ${item.detail||''}`));
      if(within(lead.assignedAt||lead.createdAt)||match(/lead (?:reassigned|assigned)/i))counts['Leads assigned / received']++;
      if(match(/(?:→|to) Contacted\b|call connected|contacted via|whatsapp sent|email sent/i))counts['Leads contacted']++;
      if(match(/meeting completed|meeting held/i))counts['Meetings completed']++;
      if(match(/(?:→|to) Proposal sent\b|^proposal sent\b/i))counts['Proposals sent']++;
      if((lead.status==='Won'&&within(lead.closedAt))||match(/opportunity won|(?:→|to) Won\b/i))counts['Deals won']++;
      if((lead.status==='Lost'&&within(lead.lostAt))||match(/opportunity lost|(?:→|to) Lost\b/i))counts['Deals lost']++;
      counts['Calls logged']+=events.filter(item=>/^call\b/i.test(item.title||'')).length;
      counts['Follow-ups completed']+=events.filter(item=>/follow.up completed/i.test(item.title||'')).length;
    }
    return [['Metric','Count'],...Object.entries(counts)];
  }
  root.CrmTaskHelpers={parseTitle,automaticTasks,activityRows};
})(globalThis);
