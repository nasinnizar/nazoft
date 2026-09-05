import { getUser,json,parseJson,rateLimit } from '../src/services/vercel-request.js';
import { mutationIsSameOrigin } from '../src/middleware/request-security.js';
import { manageIntegration,receiveIntegration } from '../src/services/lead-integrations.js';
export default async function handler(request,response) {
  response.setHeader('Cache-Control','no-store');
  try {
    const url=new URL(request.url,'https://local.invalid'),action=url.searchParams.get('action')||'status';
    if(action==='receive') {
      if(request.method!=='POST')return json(response,405,{error:'POST required'});
      if(!await rateLimit(request,response,'lead-inbound',120))return;
      const body=await parseJson(request);
      return json(response,200,await receiveIntegration(url.searchParams.get('id')||'',request.headers['x-crm-key']||body.google_key,body));
    }
    if(request.method!==(action==='status'?'GET':'POST'))return json(response,405,{error:'Method not allowed'});
    if(request.method==='POST'&&!mutationIsSameOrigin(request))return json(response,403,{error:'CRM origin required'});
    const user=await getUser(request,response);if(!user)return json(response,401,{error:'Sign in first'});
    if(!await rateLimit(request,response,`integration:${user.id}`,30))return;
    const body=request.method==='POST'?await parseJson(request):{};
    return json(response,200,await manageIntegration(user.id,action,url.searchParams.get('kind'),body.ownerEmail));
  }catch(error){return json(response,error.statusCode||503,{error:error.statusCode?error.message:'Integration unavailable. Check server setup and migration 005.'});}
}
