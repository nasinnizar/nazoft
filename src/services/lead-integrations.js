import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { requireOrganizationAdmin } from './workspace.js';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const hash=value=>createHash('sha256').update(value).digest('hex');
export function normalizeInbound(kind, body) {
  const clean=value=>typeof value==='string'?value.trim().slice(0,2000):'';
  const fields=kind==='google'?Object.fromEntries((Array.isArray(body.user_column_data)?body.user_column_data:[]).map(x=>[x.column_id,clean(x.string_value)])):body;
  const data=kind==='google'?{name:fields.FULL_NAME||[fields.FIRST_NAME,fields.LAST_NAME].filter(Boolean).join(' '),email:fields.EMAIL,phone:fields.PHONE_NUMBER,company:fields.COMPANY_NAME}:fields;
  const externalId=clean(kind==='google'?body.lead_id:body.submission_id);
  if(!externalId||externalId.length>200)throw fail('A unique submission ID is required.');
  const lead=Object.fromEntries(['name','email','phone','company'].map(k=>[k,clean(data[k])]));
  if(!lead.email&&!lead.phone)throw fail('Email or phone is required.');
  lead.name ||= lead.email||lead.phone;
  return {externalId,lead,test:body.is_test===true};
}
export async function manageIntegration(userId, action, kind, ownerEmail) {
  const member=await requireOrganizationAdmin(userId);
  if(!['google','website'].includes(kind))throw fail('Unknown integration.');
  if(action==='status') {
    const configured=env.APP_URL?.startsWith('https://');
    let rows;try{({rows}=await pool.query('select id,kind,owner_email,last_received_at,last_test_at from public.lead_integrations where organization_id=$1 and kind=$2',[member.organization_id,kind]));}catch(error){if(error.code==='42P01')return {ready:false,message:'Database migration 005 is required.'};throw error;}
    return {ready:!!configured,message:configured?'Ready to configure.':'A public HTTPS server address is required.',connection:rows[0]?{...rows[0],url:new URL(`/api/lead-integrations?action=receive&id=${rows[0].id}`,env.APP_URL).href}:null};
  }
  if(action==='disconnect'){await pool.query('delete from public.lead_integrations where organization_id=$1 and kind=$2',[member.organization_id,kind]);return {message:'Disconnected. Existing leads are retained.'};}
  if(action!=='connect'||!env.APP_URL?.startsWith('https://'))throw fail('Configure a public HTTPS server address first.');
  const owner=await pool.query("select u.email from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=$1 and m.status='active' and m.role in ('admin','manager','sales') and lower(u.email)=lower($2)",[member.organization_id,ownerEmail||'']);
  if(!owner.rowCount)throw fail('Choose an active lead owner.');
  const key=randomBytes(32).toString('hex');
  const {rows}=await pool.query('insert into public.lead_integrations(id,organization_id,kind,key_hash,owner_email) values($1,$2,$3,$4,$5) on conflict(organization_id,kind) do update set key_hash=excluded.key_hash,owner_email=excluded.owner_email returning id',[randomUUID(),member.organization_id,kind,hash(key),owner.rows[0].email]);
  return {key,url:new URL(`/api/lead-integrations?action=receive&id=${rows[0].id}`,env.APP_URL).href};
}
export async function receiveIntegration(id, key, body) {
  if(!/^[a-f0-9-]{36}$/i.test(id)||typeof key!=='string'||key.length>200)throw fail('Invalid connection.',403);
  const client=await pool.connect();
  try {
    await client.query('begin');
    const connection=(await client.query('select * from public.lead_integrations where id=$1 for update',[id])).rows[0];
    if(!connection||!timingSafeEqual(Buffer.from(hash(key)),Buffer.from(connection.key_hash)))throw fail('Invalid connection key.',403);
    const {externalId,lead,test}=normalizeInbound(connection.kind,body);
    if(test){await client.query('update public.lead_integrations set last_test_at=now() where id=$1',[id]);await client.query('commit');return {test:true};}
    const workspace=(await client.query('select state from public.organization_workspaces where organization_id=$1 for update',[connection.organization_id])).rows[0];
    if(!workspace)throw fail('Workspace unavailable.',503);
    const receipt=await client.query('insert into public.integration_receipts values($1,$2) on conflict do nothing returning external_id',[id,externalId]);
    if(!receipt.rowCount){await client.query('commit');return {duplicate:true};}
    const owner=(await client.query("select u.email,coalesce(p.display_name,u.email) name from public.organization_members m join auth.users u on u.id=m.user_id left join public.profiles p on p.user_id=u.id where m.organization_id=$1 and m.status='active' and m.role in ('admin','manager','sales') and lower(u.email)=lower($2)",[connection.organization_id,connection.owner_email])).rows[0];
    if(!owner)throw fail('Lead owner is inactive. Update integration settings.',503);
    const state=workspace.state||{},now=Date.now();
    const number=Math.max(0,...[...(state.leads||[]),...(state.deletedLeads||[])].map(l=>Number(String(l.leadNumber||'').match(/(\d+)$/)?.[1]||0)),Number(state.recordCounters?.leadNumber?.value||0))+1;
    Object.assign(lead,{leadNumber:`LD_${String(number).padStart(4,'0')}`,integrationLeadId:externalId,integrationId:id,source:connection.kind==='google'?'Google Ads':'Website form',status:'Uncontacted',stage:0,pipeline:state.pipelines?.[0]?.name||'',product:'',value:0,temperature:'',owner:owner.name,ownerEmail:owner.email,assignedBy:'Lead integration',createdAt:now,assignedAt:now,followAt:'',timeline:[{title:'Lead received',detail:connection.kind==='google'?'Google Ads lead form':'Website form',at:now,actor:'Integration'}]});
    state.leads=[...(state.leads||[]),lead];state.recordCounters={...state.recordCounters,leadNumber:{year:new Date().getFullYear(),value:number}};
    await client.query('update public.organization_workspaces set state=$2::jsonb,updated_at=now() where organization_id=$1',[connection.organization_id,JSON.stringify(state)]);
    await client.query('update public.lead_integrations set last_received_at=now() where id=$1',[id]);
    await client.query('commit');return {received:true};
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
