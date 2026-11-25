(function(){
  'use strict';
  var engine=window.BurnoutSearch,dialog=document.getElementById('bpSearchDialog'),input=document.getElementById('bpSearchInput'),button=document.getElementById('btnSearch'),results=document.getElementById('bpSearchResults'),status=document.getElementById('bpSearchStatus');
  if(!engine||!dialog||!input||!button)return;
  var lastRows=null,catalogPromise=null,revision=0,timer=null,selected=-1,returnFocus=null;
  // Only entries pushed by this document are safe to pop when closing its dialog.
  // A new cross-site tab receives copied state, not the original tab's history stack.
  var ownSearchEntries=new Set();
  function remember(patch){try{history.replaceState(Object.assign({},history.state,patch),'');}catch(e){}}
  var labels={dossier:'Dossier du site',page:'Article',section:'Passage',faq:'Question fréquente',glossaire:'Glossaire',action:'Au cabinet'};
  var lastQuery='';
  function catalog(){
    if(!catalogPromise)catalogPromise=fetch('/assets/index-recherche.json').then(function(r){if(!r.ok)throw Error('catalog');return r.json();}).catch(function(e){catalogPromise=null;throw e;});
    return catalogPromise;
  }
  function highlighted(text,query,size){
    var p=document.createElement('p'),ex=engine.excerpt?engine.excerpt(text,query,size):{parts:[{t:text,m:false}]};
    ex.parts.forEach(function(part){if(part.m){var m=document.createElement('mark');m.textContent=part.t;p.appendChild(m);}else p.appendChild(document.createTextNode(part.t));});
    return p;
  }
  function localLink(row){
    var a=document.createElement('a');a.className='bp-search-result bp-r-'+(row.type||'page');a.href=row.url;
    if(row.type==='action'){
      var existing=document.querySelector('.header-actions a[href*="doctolib.fr"]');
      if(existing){a.href=existing.href;a.target='_blank';a.rel='noopener';}
    }
    var small=document.createElement('small');small.textContent=(labels[row.type]||'Article')+(row.page&&row.type!=='faq'?' · '+row.page:row.type==='faq'?' · FAQ':'');
    var title=document.createElement('strong');title.textContent=row.title;
    a.append(small,title);
    if(row.passage){
      var sub=document.createElement('span');sub.className='bp-search-passage';sub.textContent='Passage : '+row.passage.title;a.appendChild(sub);
      a.href=row.passage.url;
      a.dataset.passage=row.passage.url;
      a.appendChild(highlighted(row.passage.text,lastQuery,30));
    }else if(row.type==='section'||row.type==='faq'){
      a.appendChild(highlighted(row.text||row.description||'',lastQuery,30));
    }else{
      var desc=document.createElement('p');desc.textContent=row.description||'';a.appendChild(desc);
    }
    return a;
  }
  function suggestions(){
    // Avant toute saisie : les portes d'entrée les plus utiles.
    var picks=[['/test-burnout-parental.html','Faire le test du burn-out parental','Un questionnaire rapide, confidentiel, résultat immédiat.'],
      ['/signes-symptomes.html','Reconnaître les signes','Fatigue, colère, distance avec l\u2019enfant, culpabilité.'],
      ['/quand-consulter.html','Quand consulter ?','Les signaux qui montrent qu\u2019il est temps de se faire aider.'],
      ['/situations.html','Selon votre situation','Mère, père, parent solo, famille recomposée, post-partum…'],
      ['/glossaire.html','Le glossaire','Les mots du burn-out parental expliqués simplement.']];
    results.replaceChildren();selected=-1;
    var h=document.createElement('p');h.className='bp-search-help';h.textContent='Pour commencer :';results.appendChild(h);
    picks.forEach(function(x){var a=document.createElement('a');a.className='bp-search-result';a.href=x[0];var st=document.createElement('strong');st.textContent=x[1];var d=document.createElement('p');d.textContent=x[2];a.append(st,d);results.appendChild(a);});
  }
  function links(){return Array.from(results.querySelectorAll('a'));}
  function mark(index){
    var list=links();selected=Math.max(-1,Math.min(index,list.length-1));
    list.forEach(function(a,i){a.classList.toggle('is-selected',i===selected);});
    if(selected>=0)list[selected].scrollIntoView({block:'nearest'});
  }
  function paint(local,external,query,failed){
    results.replaceChildren();selected=-1;
    var nodes=local.map(localLink),remote=[];
    if(window.CabinetNetwork)remote=external.map(function(r){return window.CabinetNetwork.createLink(r);});
    nodes.splice(Math.min(nodes.length,3),0,...remote);nodes.forEach(function(n){results.appendChild(n);});
    status.textContent=nodes.length?nodes.length+' résultat'+(nodes.length>1?'s':'')+' pour « '+query+' ».':failed?'La recherche est momentanément indisponible. Réessayez ou ouvrez le glossaire.':'Aucun résultat pour « '+query+' ». Essayez un autre mot ou une expression plus courte.';
    if(!nodes.length){
      var fix=engine.suggest&&lastRows?engine.suggest(lastRows,query):'';
      if(fix){var b=document.createElement('button');b.type='button';b.className='bp-search-fix';b.textContent='Essayer « '+fix+' »';b.addEventListener('click',function(){input.value=fix;input.focus();search();});results.appendChild(b);}
      var a=document.createElement('a');a.className='bp-search-result';a.href='/glossaire.html';a.textContent='Parcourir le glossaire';results.appendChild(a);
    }
  }
  async function search(){
    var id=++revision,q=input.value.trim();
    lastQuery=q;
    if(q.length<2){suggestions();status.textContent='Écrivez un mot ou une question : sommeil, je crie, test, consulter…';return;}
    status.textContent='Recherche en cours…';
    var local=[],remote=[],failed=false;
    var tasks=[catalog().then(function(rows){lastRows=rows;local=engine.rank(rows,q,8);}).catch(function(){failed=true;})];
    if(window.CabinetNetwork)tasks.push(window.CabinetNetwork.search(q,'burnout').then(function(rows){remote=rows;}).catch(function(){}));
    await Promise.all(tasks);if(id!==revision)return;paint(local,remote,q,failed);
    if(history.state&&history.state.bpSearch)remember({bpSearchQuery:q});
  }
  function show(fromHistory){
    if(dialog.open)return;
    returnFocus=document.activeElement;
    // Avoid leaving an inaccessible panel beneath the modal.
    ['btnCloseMenu','btnCloseA11y'].forEach(function(id){var b=document.getElementById(id);if(b&&b.closest('.is-open'))b.click();});
    dialog.showModal();button.setAttribute('aria-expanded','true');
    if(!fromHistory){try{var entry=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);history.pushState(Object.assign({},history.state,{bpSearch:true,bpSearchQuery:input.value,bpSearchEntry:entry}),'');ownSearchEntries.add(entry);}catch(e){}}
    input.focus();search();
  }
  function hide(fromHistory){
    if(dialog.open)dialog.close();button.setAttribute('aria-expanded','false');
    if(!fromHistory&&history.state&&history.state.bpSearch){
      if(ownSearchEntries.has(history.state.bpSearchEntry))history.back();
      else remember({bpSearch:false,bpSearchEntry:null});
    }
    if(returnFocus&&returnFocus.isConnected)returnFocus.focus();
  }
  button.addEventListener('click',function(){show(false);});
  document.getElementById('bpSearchClose').addEventListener('click',function(){hide(false);});
  dialog.addEventListener('cancel',function(e){e.preventDefault();hide(false);});
  dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)hide(false);}});
  input.addEventListener('input',function(){dialog.scrollTop=0;remember({bpSearchQuery:input.value});clearTimeout(timer);revision++;timer=setTimeout(search,120);});
  input.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){e.preventDefault();mark(selected+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();mark(selected-1);}
    else if(e.key==='Enter'){e.preventDefault();var list=links(),link=list[selected>=0?selected:0];if(link)link.click();}
  });
  results.addEventListener('click',function(e){
    var a=e.target.closest('a');if(!a)return;
    var target=new URL(a.href,location.href);
    if(target.origin===location.origin&&target.pathname===location.pathname&&target.hash){
      // A glossary anchor on this page must not remain hidden behind the dialog.
      if(dialog.open)dialog.close();button.setAttribute('aria-expanded','false');
    }
  });
  // The first Back closes search. Back from an article restores the query and results.
  function restore(){if(history.state&&history.state.bpSearch){input.value=history.state.bpSearchQuery||input.value;show(true);}else if(dialog.open)hide(true);}
  window.addEventListener('popstate',restore);window.addEventListener('pageshow',restore);
  var gloss=document.getElementById('glossSearch'),entries=document.getElementById('glossEntries'),count=document.getElementById('glossCount'),network=document.getElementById('glossNetwork'),glossRevision=0,glossTimer;
  if(gloss&&entries){
    var items=Array.from(entries.querySelectorAll('.gloss-item'));
    async function filterGloss(){
      var id=++glossRevision,q=gloss.value.trim(),ts=engine.terms(q).map(function(t){return engine.stem?engine.stem(t):t;}),visible=0;
      items.forEach(function(item){var words=' '+engine.normalize((item.dataset.glossTerms||'')+' '+item.textContent)+' ';item.hidden=!!q&&!ts.every(function(t){return words.indexOf(' '+t)!==-1;});if(!item.hidden)visible++;});
      count.textContent=q?visible+' entrée'+(visible>1?'s':'')+' trouvée'+(visible>1?'s':'')+'.':'';
      network.replaceChildren();
      if(q.length>=2&&window.CabinetNetwork){try{var found=await window.CabinetNetwork.search(q,'burnout');if(id!==glossRevision)return;found.forEach(function(row){network.appendChild(window.CabinetNetwork.createLink(row));});}catch(e){}}
    }
    gloss.addEventListener('input',function(){remember({bpGlossQuery:gloss.value});clearTimeout(glossTimer);glossRevision++;glossTimer=setTimeout(filterGloss,120);});
    function resetGloss(){gloss.value='';remember({bpGlossQuery:''});clearTimeout(glossTimer);glossRevision++;items.forEach(function(item){item.hidden=false;});count.textContent='';network.replaceChildren();}
    document.querySelectorAll('.alpha-nav a').forEach(function(a){a.addEventListener('click',resetGloss);});
    entries.addEventListener('click',function(e){if(e.target.closest('a[href^="#"]'))resetGloss();});
    function restoreGloss(){
      if(history.state&&Object.prototype.hasOwnProperty.call(history.state,'bpGlossQuery'))gloss.value=history.state.bpGlossQuery||'';
      clearTimeout(glossTimer);filterGloss();
    }
    window.addEventListener('pageshow',restoreGloss);
    window.addEventListener('popstate',restoreGloss);
    document.addEventListener('cabinet:restore',restoreGloss);
  }
  document.addEventListener('cabinet:before-leave',function(e){
    var patch={bpSearch:dialog.open,bpSearchQuery:input.value};if(gloss)patch.bpGlossQuery=gloss.value;
    remember(patch);
    if(e.detail)e.detail.history=Object.assign({},history.state);
  });
  document.addEventListener('cabinet:restore',restore);
  // Un lien vers une question ou un passage replié l'ouvre et le montre.
  function openTarget(){
    if(!location.hash||location.hash.length<2)return;
    var el=null;try{el=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch(e){}
    if(!el)return;
    var d=el.tagName==='DETAILS'?el:el.closest('details');
    while(d){d.open=true;d=d.parentElement&&d.parentElement.closest('details');}
    setTimeout(function(){el.scrollIntoView({block:'start'});},60);
  }
  window.addEventListener('hashchange',openTarget);
  if(document.readyState!=='loading')openTarget();else document.addEventListener('DOMContentLoaded',openTarget);
})();
