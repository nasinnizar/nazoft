(() => {
  if(window.__NAZOFT_AUTHENTICATED__&&location.pathname==='/login'){location.replace('/app');return;}
  const routes={today:'dashboard',tasks:'tasks',leads:'leads',pipeline:'pipeline',proposals:'proposals',library:'content',activities:'activities',performance:'reports',settings:'settings'};
  const reverse=Object.fromEntries(Object.entries(routes).map(([key,value])=>[value,key]));
  const base=page;
  page=function(id){
    if(!window.__NAZOFT_AUTHENTICATED__){location.replace('/login');return;}
    base(id);
    if(routes[id])history.replaceState(null,'',`/app/${routes[id]}${location.search}`);
  };
  if(window.__NAZOFT_AUTHENTICATED__&&location.pathname.startsWith('/app')) {
    const target=reverse[location.pathname.split('/')[2]];
    if(target)page(target);
  }
})();
