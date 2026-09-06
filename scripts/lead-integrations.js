(() => {
  const kinds={google:'Google Ads',website:'Forms & webhooks'};
  const anchor=document.querySelector('[data-setting="meta"]');
  Object.entries(kinds).reverse().forEach(([kind,title])=>{
    const button=document.createElement('button');button.dataset.setting=kind;button.textContent=title;
    button.onclick=()=>selectSetting(kind);anchor?.after(button);
  });
  const baseHtml=settingsHtml;
  settingsHtml=function(name){
    if(!kinds[name])return baseHtml(name);
    return `<h2>${kinds[name]}</h2><p class="muted">${name==='google'?'Receive new Google Ads lead-form submissions directly into this workspace. This does not manage ad campaigns or import ad performance.':'Connect Google Forms or an existing website form through a secure server webhook. Never expose the connection key in public browser JavaScript or HTML.'}</p>${name==='website'?'<div class="preference-intro"><div><b>Google Forms</b><div>Add an Apps Script form-submit trigger that sends each response to the webhook below. Map responses to submission_id, name, email, phone, and optional company fields.</div></div></div>':''}<div id="inboundStatus" role="status">Checking setup…</div><div id="inboundControls"></div>`;
  };
  const baseRender=renderConfigSetting;
  renderConfigSetting=function(name=currentSetting){baseRender(name);if(kinds[name])load(name);};
  async function api(kind,action,body){
    const response=await fetch(`/api/lead-integrations?kind=${kind}&action=${action}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Connection request failed');return result;
  }
  async function load(kind){
    const status=document.querySelector('#inboundStatus'),controls=document.querySelector('#inboundControls');
    try {
      const result=await api(kind,'status');if(!status.isConnected)return;
      status.textContent=result.message;
      if(!result.ready)return;
      const connection=result.connection;
      controls.innerHTML=`<p>${connection?'Configured · verify delivery using a test submission.':'Not connected'}</p>${connection?`<p class="muted">Last live delivery: ${safe(connection.last_received_at?new Date(connection.last_received_at).toLocaleString():'None')}<br>Last test: ${safe(connection.last_test_at?new Date(connection.last_test_at).toLocaleString():'None')}</p><label class="field">Webhook URL<input readonly value="${safe(connection.url)}"></label>`:''}<label class="field">Assign new leads to<select id="inboundOwner"><option value="">Choose user</option>${users.filter(u=>u.email).map(u=>`<option value="${safe(u.email)}" ${u.email===connection?.owner_email?'selected':''}>${safe(u.name||u.email)}</option>`).join('')}</select></label><div class="actions"><button class="btn primary" id="inboundConnect">${connection?'Replace connection key':'Create connection'}</button>${connection?'<button class="btn danger" id="inboundDisconnect">Disconnect</button>':''}</div><div id="inboundSecret"></div><p class="muted">${kind==='google'?'In Google Ads, open your lead form’s export settings and enter this webhook URL and key. Use Google’s test button; test leads will not be added to your client list.':'Your website backend must POST JSON with submission_id (unique per submission), name, email and/or phone, and optional company. Send the key in the X-CRM-Key header. Retry failed requests using the same submission_id. Add is_test: true to verify without creating a client. Protect your public form with spam controls and rate limits.'}</p>`;
      controls.querySelector('#inboundConnect').onclick=async e=>{
        if(connection&&!confirm('Replace the key? The current connection will stop until its key is updated.'))return;
        const button=e.currentTarget;button.disabled=true;
        try{const reply=await api(kind,'connect',{ownerEmail:controls.querySelector('#inboundOwner').value});
          const area=controls.querySelector('#inboundSecret');
          area.innerHTML='<p>Save this key securely now. It is shown only once. Set both values in your integration, then refresh this page after sending a test.</p><label class="field">Webhook URL<input readonly></label><label class="field">Connection key<input readonly type="password"></label><button class="btn" type="button">Show / hide key</button>';
          const inputs=area.querySelectorAll('input');inputs[0].value=reply.url;inputs[1].value=reply.key;
          area.querySelector('button').onclick=()=>inputs[1].type=inputs[1].type==='password'?'text':'password';
          status.textContent='Connection created. Delivery has not yet been verified.';
        }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
      };
      controls.querySelector('#inboundDisconnect')?.addEventListener('click',async()=>{
        if(!confirm('Disconnect this source? Existing client records will remain.'))return;
        try{await api(kind,'disconnect',{});load(kind);}catch(error){status.textContent=error.message;}
      });
    }catch(error){if(status.isConnected)status.textContent=error.message;}
  }
})();
