(() => {
  const htmlBase=settingsHtml;
  settingsHtml=function(name){if(name!=='meta')return htmlBase(name);return '<h2>Meta Lead Ads</h2><p class="muted">Connect your Facebook Pages securely. Page tokens stay encrypted on the server; never paste secrets here.</p><div id="metaConnectionStatus" role="status">Checking connection setup…</div><button type="button" class="btn primary" id="connectMeta" disabled>Connect Meta</button><div id="metaPages"></div>';};
  async function api(action,body) {
    const response=await fetch(`/api/meta?action=${action}`,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Meta request failed');return result;
  }
  const renderBase=renderConfigSetting;
  renderConfigSetting=function(name=currentSetting){renderBase(name);if(name==='meta')load();};
  async function load() {
    const area=document.querySelector('#metaConnectionStatus'),button=document.querySelector('#connectMeta'),list=document.querySelector('#metaPages');if(!area)return;
    button.onclick=async()=>{button.disabled=true;try{const result=await api('connect',{});location.assign(result.url);}catch(error){area.textContent=error.message;button.disabled=false;}};
    try {
      const result=await api('status');if(!area.isConnected)return;
      area.textContent=result.configured?'Choose a Page and fallback lead owner, then enable lead sync.':'Setup required: Nazoft must configure its Meta app, HTTPS callback and encryption key before clients can connect.';
      button.disabled=!result.configured;
      list.innerHTML=result.pages.map(page=>`<div class="setting-row"><div class="grow"><b>${safe(page.page_name)}</b><small class="muted">${page.subscribed?'Lead sync enabled':'Not subscribed'} · ${safe(page.page_id)}</small></div><label>Fallback owner<select data-page-owner="${safe(page.page_id)}"><option value="">Choose user</option>${users.filter(user=>user.email&&!/suspended|viewer/i.test(`${user.role} ${user.status}`)).map(user=>`<option value="${safe(user.email)}" ${page.owner_email===user.email?'selected':''}>${safe(user.name||user.email)}</option>`).join('')}</select></label><button class="btn" data-meta-action="subscribe" data-meta-page="${safe(page.page_id)}">Enable / update sync</button><button class="btn" data-meta-action="test" data-meta-page="${safe(page.page_id)}">Test access</button><button class="btn danger" data-meta-action="disconnect" data-meta-page="${safe(page.page_id)}">Disconnect</button></div>`).join('');
      list.querySelectorAll('[data-meta-action]').forEach(action=>action.onclick=async()=>{action.disabled=true;try{const owner=list.querySelector(`[data-page-owner="${action.dataset.metaPage}"]`).value;const reply=await api(action.dataset.metaAction,{pageId:action.dataset.metaPage,ownerEmail:owner});await load();area.textContent=reply.message;}catch(error){area.textContent=error.message;}finally{action.disabled=false;}});
    }catch(error){area.textContent=error.message;}
  }
  if(new URLSearchParams(location.search).get('meta')==='connected'){page('settings');selectSetting('meta');}
})();
