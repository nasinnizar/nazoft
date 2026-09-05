import { getUser,json,parseJson,rateLimit } from '../src/services/vercel-request.js';
import { mutationIsSameOrigin } from '../src/middleware/request-security.js';
import { status,begin,callback,pageAction,metaConfig,receiveLead } from '../src/services/meta.js';
import { validSignature } from '../src/services/meta-security.js';
export const config={api:{bodyParser:false}};
export default async function handler(request,response) {
  response.setHeader('Cache-Control','no-store');
  const url=new URL(request.url,'https://local.invalid'),action=url.searchParams.get('action')||'status';
  try {
    if(action==='webhook') {
      const settings=metaConfig();
      if(request.method==='GET') {
        if(url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===settings.verify){response.statusCode=200;return response.end(url.searchParams.get('hub.challenge')||'');}
        return json(response,403,{error:'Webhook verification failed'});
      }
      if(request.method!=='POST')return json(response,405,{error:'Method not allowed'});
      let body=request.body;
      if(!Buffer.isBuffer(body)) {const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>2*1024*1024)return json(response,413,{error:'Payload too large'});chunks.push(chunk);}body=Buffer.concat(chunks);}
      if(!validSignature(body,request.headers['x-hub-signature-256'],settings.secret))return json(response,403,{error:'Invalid webhook signature'});
      const payload=JSON.parse(body.toString('utf8'));
      if(payload.object!=='page')return json(response,400,{error:'Expected Page event'});
      for(const entry of payload.entry||[])for(const change of entry.changes||[])if(change.field==='leadgen')await receiveLead(String(entry.id),String(change.value?.leadgen_id||''));
      return json(response,200,{received:true});
    }
    if(!['status','callback'].includes(action)&&request.method!=='POST')return json(response,405,{error:'POST required'});
    if(['status','callback'].includes(action)&&request.method!=='GET')return json(response,405,{error:'GET required'});
    if(request.method==='POST'&&!mutationIsSameOrigin(request))return json(response,403,{error:'CRM origin required'});
    const user=await getUser(request,response);if(!user)return json(response,401,{error:'Sign in to the CRM first'});
    if(action==='status')return json(response,200,await status(user.id));
    if(!await rateLimit(request,response,`meta:${user.id}`,30))return;
    if(action==='connect')return json(response,200,await begin(user.id));
    if(action==='callback'){await callback(user.id,url.searchParams.get('code'),url.searchParams.get('state'));response.statusCode=303;response.setHeader('Location','/?meta=connected');return response.end();}
    const body=await parseJson(request);
    if(!/^\d+$/.test(String(body.pageId||'')))return json(response,400,{error:'Choose a connected Page'});
    return json(response,200,await pageAction(user.id,action,String(body.pageId),body.ownerEmail));
  }catch(error){return json(response,error.statusCode||503,{error:error.statusCode?error.message:'Meta service unavailable. Check setup, database migration and Page permissions.'});}
}
