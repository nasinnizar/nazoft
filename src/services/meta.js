import { createHash, randomBytes, createHmac } from 'node:crypto';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { requireOrganizationAdmin } from './workspace.js';
import { encryptToken,decryptToken } from './meta-security.js';
import { applyAssignmentRules } from './assignment-rules.js';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export function metaConfig() {
  const config={id:process.env.META_APP_ID,secret:process.env.META_APP_SECRET,key:process.env.META_TOKEN_ENCRYPTION_KEY,version:process.env.META_GRAPH_VERSION,verify:process.env.META_WEBHOOK_VERIFY_TOKEN,login:process.env.META_LOGIN_CONFIG_ID};
  if(!config.id||!config.secret||!/^[a-f0-9]{64}$/i.test(config.key||'')||!/^v\d+\.\d+$/.test(config.version||'')||!config.verify||!config.login||!env.APP_URL?.startsWith('https://'))throw fail('Meta setup is incomplete. Ask the Nazoft administrator to configure the server credentials and HTTPS address.',503);
  config.callback=new URL('/api/meta?action=callback',env.APP_URL).href;
  return config;
}
async function graph(path,token,params={},method='GET') {
  const config=metaConfig(),url=new URL(`https://graph.facebook.com/${config.version}/${path}`);
  const values=new URLSearchParams(params);
  if(token)values.set('appsecret_proof',createHmac('sha256',config.secret).update(token).digest('hex'));
  if(method==='GET')url.search=values.toString();
  const response=await fetch(url,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{})},...(method==='GET'?{}:{body:values}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok||result.error)throw fail('Meta request failed. Reconnect the Page and check its lead permissions.',502);
  return result;
}
export async function status(userId) {
  const membership=await requireOrganizationAdmin(userId);
  let configured=true;try{metaConfig();}catch{configured=false;}
  if(!configured)return {configured:false,pages:[]};
  const {rows}=await pool.query('select page_id,page_name,subscribed,owner_email from public.meta_pages where organization_id=$1',[membership.organization_id]);
  return {configured,pages:rows};
}
export async function begin(userId) {
  const membership=await requireOrganizationAdmin(userId),config=metaConfig(),state=randomBytes(32).toString('hex');
  await pool.query('delete from public.meta_oauth_states where expires_at<now()');
  await pool.query("insert into public.meta_oauth_states values($1,$2,$3,now()+interval '10 minutes')",[createHash('sha256').update(state).digest('hex'),userId,membership.organization_id]);
  const url=new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.search=new URLSearchParams({client_id:config.id,redirect_uri:config.callback,state,response_type:'code',config_id:config.login}).toString();
  return {url:url.href};
}
export async function callback(userId,code,state) {
  const membership=await requireOrganizationAdmin(userId),config=metaConfig();
  if(typeof state!=='string'||!state||typeof code!=='string'||!code)throw fail('Meta authorization was cancelled or invalid.');
  const nonce=await pool.query('delete from public.meta_oauth_states where state_hash=$1 and user_id=$2 and organization_id=$3 and expires_at>now() returning state_hash',[createHash('sha256').update(state).digest('hex'),userId,membership.organization_id]);
  if(!nonce.rowCount)throw fail('Meta connection expired. Start Connect Meta again.');
  const auth=await graph('oauth/access_token',null,{client_id:config.id,client_secret:config.secret,redirect_uri:config.callback,code},'POST');
  const extended=await graph('oauth/access_token',null,{grant_type:'fb_exchange_token',client_id:config.id,client_secret:config.secret,fb_exchange_token:auth.access_token},'POST');
  let after;let count=0;
  do {
    const pages=await graph('me/accounts',extended.access_token,{fields:'id,name,access_token',limit:'100',...(after?{after}:{})});
    for(const page of pages.data||[]) {
      if(!page.access_token)continue;
      const context=`${membership.organization_id}:${page.id}`;
      await pool.query(`insert into public.meta_pages(page_id,organization_id,page_name,token_cipher) values($1,$2,$3,$4)
        on conflict(page_id) do update set page_name=excluded.page_name,token_cipher=excluded.token_cipher,updated_at=now()
        where meta_pages.organization_id=excluded.organization_id`,[page.id,membership.organization_id,page.name,encryptToken(page.access_token,config.key,context)]);
      count++;
    }
    after=pages.paging?.next?pages.paging?.cursors?.after:null;
  }while(after&&count<1000);
}
export async function pageAction(userId,action,pageId,ownerEmail) {
  const membership=await requireOrganizationAdmin(userId),config=metaConfig();
  const {rows}=await pool.query('select * from public.meta_pages where page_id=$1 and organization_id=$2',[pageId,membership.organization_id]);
  const page=rows[0];if(!page)throw fail('Page is not connected to this workspace.',404);
  const token=decryptToken(page.token_cipher,config.key,`${membership.organization_id}:${page.page_id}`);
  if(action==='test') {const result=await graph(page.page_id,token,{fields:'id,name'});const forms=await graph(`${page.page_id}/leadgen_forms`,token,{fields:'id',limit:'1'});return {message:`Page access verified: ${result.name}. Lead-form listing succeeded. Use Meta’s Lead Ads Testing Tool to verify delivery.`,formsAccessible:Array.isArray(forms.data)};}
  if(action==='disconnect') {
    if(page.subscribed)await graph(`${page.page_id}/subscribed_apps`,token,{},'DELETE');
    await pool.query('delete from public.meta_pages where page_id=$1 and organization_id=$2',[pageId,membership.organization_id]);return {message:'Page disconnected; stored Page token removed.'};
  }
  if(action!=='subscribe')throw fail('Unknown Meta action.');
  const member=await pool.query("select u.email from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=$1 and m.status='active' and m.role in ('admin','manager','sales') and lower(u.email)=lower($2)",[membership.organization_id,ownerEmail||'']);
  if(!member.rowCount)throw fail('Choose an active lead owner.');
  await graph(`${page.page_id}/subscribed_apps`,token,{subscribed_fields:'leadgen'},'POST');
  await pool.query('update public.meta_pages set subscribed=true,owner_email=$2 where page_id=$1',[page.page_id,member.rows[0].email]);
  return {message:'Page subscribed. New leads will use campaign rules, then this fallback owner.'};
}
export async function receiveLead(pageId,leadId) {
  if(!/^\d+$/.test(pageId)||!/^\d+$/.test(leadId))throw fail('Invalid Meta identifier.');
  const page=(await pool.query('select * from public.meta_pages where page_id=$1 and subscribed=true',[pageId])).rows[0];
  if(!page)return;
  const config=metaConfig(),token=decryptToken(page.token_cipher,config.key,`${page.organization_id}:${page.page_id}`);
  const data=await graph(leadId,token,{fields:'id,created_time,field_data,ad_id,form_id'});
  let campaign='';
  if(data.ad_id){const ad=await graph(data.ad_id,token,{fields:'campaign{name}'});campaign=ad.campaign?.name||'';}
  const client=await pool.connect();
  try {
    await client.query('begin');
    const workspace=(await client.query('select state from public.organization_workspaces where organization_id=$1 for update',[page.organization_id])).rows[0];
    if(!workspace)throw fail('Workspace unavailable.',503);
    const inserted=await client.query('insert into public.meta_received_leads(page_id,lead_id) values($1,$2) on conflict do nothing returning lead_id',[pageId,leadId]);
    if(!inserted.rowCount){await client.query('commit');return;}
    const state=workspace.state||{},previous=structuredClone(state),members=(await client.query("select u.email,coalesce(p.display_name,u.email) name from public.organization_members m join auth.users u on u.id=m.user_id left join public.profiles p on p.user_id=u.id where m.organization_id=$1 and m.status='active' and m.role in ('admin','manager','sales')",[page.organization_id])).rows;
    const owner=members.find(member=>member.email.toLowerCase()===page.owner_email?.toLowerCase());
    if(!owner)throw fail('Fallback lead owner is inactive. Update Meta Page settings.',503);
    const fields=Object.fromEntries((data.field_data||[]).map(field=>[field.name,String(field.values?.[0]||'')]));
    const number=Math.max(0,...[...(state.leads||[]),...(state.deletedLeads||[])].map(lead=>Number(String(lead.leadNumber||'').match(/(\d+)$/)?.[1]||0)),Number(state.recordCounters?.leadNumber?.value||0))+1;
    const now=Date.now(),lead={name:fields.full_name||[fields.first_name,fields.last_name].filter(Boolean).join(' ')||'Meta lead',email:fields.email||'',phone:fields.phone_number||'',company:fields.company_name||'',source:'Meta Ad',campaignName:campaign,metaLeadId:leadId,metaPageId:pageId,metaFormId:data.form_id||'',leadNumber:`LD_${String(number).padStart(4,'0')}`,status:'Uncontacted',stage:0,pipeline:state.pipelines?.[0]?.name||'',temperature:'',value:0,ownerEmail:owner.email,owner:owner.name,assignedBy:'Meta Page fallback',createdAt:now,assignedAt:now,followAt:'',timeline:[{title:'Lead received from Meta',detail:campaign||'Lead Ad form',at:now,actor:'Meta integration'}]};
    state.leads=[...(state.leads||[]),lead];state.recordCounters={...state.recordCounters,leadNumber:{year:new Date().getFullYear(),value:number}};
    applyAssignmentRules(state,previous,members,now);
    await client.query('update public.organization_workspaces set state=$2::jsonb,updated_at=now() where organization_id=$1',[page.organization_id,JSON.stringify(state)]);
    await client.query('commit');
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
