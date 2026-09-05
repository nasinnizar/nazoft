const normalize = value => String(value || '').trim().toLowerCase();

export function applyAssignmentRules(state, previous, members, now = Date.now()) {
  const rules = Array.isArray(state.assignmentRules) ? state.assignmentRules.filter(rule => rule && typeof rule.keyword === 'string' && typeof rule.ownerEmail === 'string').slice(0,100) : [];
  const existing = new Set((previous.leads || []).map(lead => lead.leadNumber).filter(Boolean));
  for (const lead of state.leads || []) {
    if (!lead.leadNumber || existing.has(lead.leadNumber) || !/meta|facebook|instagram/i.test(lead.source || '')) continue;
    const campaign = normalize(lead.campaignName || lead.campaign_name || lead.campaign || lead.attribution?.campaignName || lead.attribution?.campaign_name);
    if (!campaign) continue;
    const rule = rules.find(rule => rule.enabled !== false && normalize(rule.keyword) && campaign.includes(normalize(rule.keyword)) && members.some(member => normalize(member.email) === normalize(rule.ownerEmail)));
    if (!rule) continue;
    const member = members.find(member => normalize(member.email) === normalize(rule.ownerEmail));
    lead.ownerEmail = normalize(member.email);
    lead.owner = member.name || member.email;
    lead.assignedBy = `Campaign rule: ${rule.keyword}`;
    lead.timeline = [...(lead.timeline || []), {title:'Lead assigned by campaign rule',detail:`${rule.keyword} → ${lead.owner}`,at:now,actor:'Assignment automation'}];
  }
  return state;
}
