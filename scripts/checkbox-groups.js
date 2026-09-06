(() => {
  function enhanceCheckboxes(root = document) {
    const inputs=[];
    if(root instanceof HTMLInputElement && root.type==='checkbox')inputs.push(root);
    if(root.querySelectorAll)inputs.push(...root.querySelectorAll('input[type="checkbox"]'));
    inputs.forEach(input=>{
      input.classList.add('crm-checkbox');
      const label=input.closest('label');
      if(label)label.classList.add('crm-checkbox-control');
    });
  }
  enhanceCheckboxes();
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
    if(node.nodeType===1)enhanceCheckboxes(node);
  }))).observe(document.body,{childList:true,subtree:true});
})();
