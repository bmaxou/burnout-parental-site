/* Recherche entre les trois sites du cabinet. Catalogue local, aucun service tiers. */
(function (root) {
  'use strict';
  var sites = {
    psy: {origin:'https://www.psy-psy.fr', label:'psy-psy.fr', logo:'/reseau/psy.png'},
    mdph: {origin:'https://bilan-mdph.fr', label:'bilan-mdph.fr', logo:'/reseau/mdph.png'},
    burnout: {origin:'https://burnout-parental.fr', label:'burnout-parental.fr', logo:'/reseau/burnout.png'}
  };
  var STOP = new Set('le la les un une des du de d l et a au aux en dans sur pour avec je j ai suis mon ma mes me se ses son sa ce cette comment pourquoi que qui est c ne pas plus'.split(' '));
  var SYN = {rdv:'rendez vous',insomnie:'sommeil',insomnies:'sommeil',dormir:'sommeil',surdoue:'hpi',surdouee:'hpi',zebre:'hpi',autiste:'autisme',autistique:'autisme',tsa:'autisme',hyperactif:'tdah',hyperactive:'tdah',dyscalculique:'dyscalculie',depressif:'depression',depressive:'depression',deprime:'depression',angoisses:'angoisse',phobique:'phobie',epuise:'epuisement',epuisee:'epuisement',fatiguee:'fatigue',fatigue:'fatigue',burnout:'burn out',burn:'burn',dsm5:'dsm 5',cim11:'cim 11'};
  function normalize(s) { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
  function words(s) { return normalize(s).split(' ').filter(function(w){return w.length>1&&!STOP.has(w);}); }
  function canonicalWord(w) { return SYN[w]||w; }
  function canonicalWords(s) { return words(words(s).map(canonicalWord).join(' ')); }
  function close(a,b,fuzzy) {
    if(a===b)return true;
    if(a.length>3&&b===a+'s'||b.length>3&&a===b+'s')return true;
    if(!fuzzy)return false;
    if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
    var i=0,j=0,n=0;
    while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++n>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}
    return n+(i<a.length||j<b.length?1:0)<=1;
  }
  var termCache=new WeakMap();
  function entryTerms(e) {
    var cached=termCache.get(e);if(cached)return cached;
    var title=normalize(e.title),aliases=(e.keywords||[]).map(normalize),ct=canonicalWords(title);
    var terms={title:title,aliases:aliases,tw:words(title),kw:words(aliases.join(' ')),dw:words(e.description),ct:ct,ck:canonicalWords(aliases.join(' ')),cd:canonicalWords(e.description),ca:aliases.map(function(a){return canonicalWords(a).join(' ');}),canonicalTitle:ct.join(' ')};
    termCache.set(e,terms);return terms;
  }
  function score(e,query,fuzzy) {
    var q=query.q,qw=query.qw,cq=query.cq,canonicalQuery=query.canonical,terms=entryTerms(e),title=terms.title,aliases=terms.aliases;
    if(!qw.length)return 0;
    function matching(queryWords,tw,kw,dw) {
      var n=0,primary=false;
      for(var i=0;i<queryWords.length;i++){
        var w=queryWords[i], t=tw.some(function(x){return close(w,x,fuzzy);}), k=kw.some(function(x){return close(w,x,fuzzy);}), d=dw.some(function(x){return close(w,x,fuzzy);});
        if(!t&&!k&&!d)return 0;
        primary=primary||t||k;n+=t?55:k?45:6;
      }
      // A passing mention in a description cannot alone trigger a suggestion.
      return primary?n:0;
    }
    // Keep literal matches and canonicalise BOTH sides. Replacing only the query
    // made exact aliases such as "maman épuisée" disappear from the results.
    var canonicalTitle=terms.canonicalTitle;
    var n=Math.max(matching(qw,terms.tw,terms.kw,terms.dw),matching(cq,terms.ct,terms.ck,terms.cd));
    if(!n)return 0;
    var exactAlias=aliases.indexOf(q)>=0||terms.ca.indexOf(canonicalQuery)>=0,exactTitle=title===q||canonicalTitle===canonicalQuery;
    // An editorial route is intentionally chosen for this exact expression.
    // Its order must not be overturned by a coincidental word in another title.
    if(e.intention&&exactAlias)return 100000-Math.min(1000,Math.max(0,Number(e.ordre)||0));
    if(exactAlias)n+=600;
    if(exactTitle)n+=500;
    if(title.indexOf(q)===0||canonicalTitle.indexOf(canonicalQuery)===0)n+=100;
    if(e.type==='dossier'){
      if(exactAlias||exactTitle)n+=650;
      else if(qw.length<=2||cq.length<=3)n+=70;
    }
    if(e.type==='glossaire')n-=10;
    return n;
  }
  function siteFor(url) {
    try {var u=new URL(url,root.location&&root.location.href||sites.psy.origin);return Object.keys(sites).find(function(id){return new URL(sites[id].origin).host.replace(/^www\./,'')===u.host.replace(/^www\./,'');})||null;}catch(e){return null;}
  }
  var catalogPromise;
  function load() {
    if(!catalogPromise)catalogPromise=fetch('/reseau/catalogue.json?v=20261116').then(function(r){if(!r.ok)throw Error('catalogue');return r.json();}).then(function(x){return x.entries||x;}).catch(function(){catalogPromise=null;return [];});
    return catalogPromise;
  }
  function rank(entries,query,current) {
    var best={},q=normalize(query),qw=words(q),cq=canonicalWords(q),queryTerms={q:q,qw:qw,cq:cq,canonical:cq.join(' ')};
    if(!qw.length)return [];
    function collect(fuzzy){
      var matched=false;
      entries.forEach(function(e){if(!sites[e.site])return;var s=score(e,queryTerms,fuzzy);if(s<=0)return;matched=true;if(e.site!==current&&(!best[e.site]||s>best[e.site].score))best[e.site]={entry:e,score:s};});
      return matched;
    }
    // Only try a typo when there is no strict match anywhere, including the
    // current site. "Psychanalyste" must not become "psychanalyse" elsewhere.
    if(!collect(false))collect(true);
    return Object.keys(best).sort(function(a,b){return best[b].score-best[a].score;}).map(function(id){return Object.assign({},best[id].entry,{logo:sites[id].logo,siteLabel:sites[id].label});});
  }
  function createLink(result) {
    var a=document.createElement('a');a.className='reseau-result';a.href=result.url;a.target='_blank';a.rel='noopener';a.dataset.reseauUrl=result.url;
    var img=document.createElement('img');img.className='reseau-logo';img.src=sites[result.site].logo;img.alt='';img.width=28;img.height=28;a.appendChild(img);
    var body=document.createElement('span');body.className='reseau-result-body';
    var title=document.createElement('strong');title.textContent=result.title;body.appendChild(title);
    var label=document.createElement('small');label.textContent=sites[result.site].label+' · nouvel onglet';body.appendChild(label);
    if(result.description){var desc=document.createElement('span');desc.className='reseau-description';desc.textContent=result.description;body.appendChild(desc);}
    a.appendChild(body);return a;
  }
  var api=root.CabinetNetwork={normalize:normalize,rank:rank,sites:sites,search:function(q,id){return load().then(function(c){return rank(c,q,id||siteFor(root.location.href));});},createLink:createLink};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  // Local preview only: separate origins let us exercise the real cross-origin history.
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&root.CabinetNetworkOrigins){Object.keys(sites).forEach(function(k){if(root.CabinetNetworkOrigins[k])sites[k].origin=root.CabinetNetworkOrigins[k];});}
  var PENDING='cabinet-reseau-depart-v1', RETURN='cabinet-reseau-retour-v1', timer=null;
  function copyState(value) {
    try{return typeof root.structuredClone==='function'?root.structuredClone(value):JSON.parse(JSON.stringify(value));}catch(e){return null;}
  }
  function capture() {
    var state={url:location.href,y:scrollY,time:Date.now(),history:copyState(history.state),details:Array.from(document.querySelectorAll('details[open][id]')).map(function(e){return e.id;})};
    document.dispatchEvent(new CustomEvent('cabinet:before-leave',{detail:state}));return state;
  }
  function restore(state) {
    if(!state||state.url!==location.href)return;
    // Restore history synchronously, before each site's DOM-ready/page-show
    // handlers restore its search, glossary or dialog. Custom UI hooks run next.
    if(Object.prototype.hasOwnProperty.call(state,'history')){try{history.replaceState(copyState(state.history),'',location.href);}catch(e){}}
    (Array.isArray(state.details)?state.details:[]).forEach(function(id){var el=document.getElementById(id);if(el&&el.tagName==='DETAILS')el.open=true;});
    setTimeout(function(){
      if(state.url!==location.href)return;
      document.dispatchEvent(new CustomEvent('cabinet:restore',{detail:state}));
      requestAnimationFrame(function(){requestAnimationFrame(function(){scrollTo(0,Number.isFinite(state.y)?state.y:0);});});
    },0);
  }
  function depart(url) {
    if(!siteFor(url)||siteFor(url)===siteFor(location.href))return false;
    var state=capture(), pending={to:url,from:state.url,state:state,time:Date.now()};
    var child;
    try {sessionStorage.setItem(PENDING,JSON.stringify(pending));child=root.open(state.url,'_blank');} catch(e) {return false;} finally {try{sessionStorage.removeItem(PENDING);}catch(e){}}
    if(!child)return false;
    return true;
  }
  api.open=depart;
  function decorate(container) {
    var anchors=container.matches&&container.matches('a')?[container]:Array.from(container.querySelectorAll('a[href],a[data-reseau-url]'));
    anchors.forEach(function(a){var url=a.dataset.reseauUrl||a.href,id=siteFor(url);if(!id||id===siteFor(location.href)||a.classList.contains('reseau-result')||a.dataset.reseauDecorated)return;
      a.dataset.reseauDecorated='1';a.dataset.reseauUrl=url;a.target='_blank';a.rel='noopener';a.classList.add('reseau-link');
      var img=document.createElement('img');img.src=sites[id].logo;img.alt=sites[id].label+' — ';img.width=22;img.height=22;img.className='reseau-logo';a.insertBefore(img,a.firstChild);
    });
  }
  function followLink(e){
    if(e.defaultPrevented||e.shiftKey||e.altKey)return;
    if(e.type==='click'&&e.button!==0||e.type==='auxclick'&&e.button!==1)return;
    var a=e.target.closest&&e.target.closest('a[href],a[data-reseau-url]');if(!a)return;
    var url=a.dataset.reseauUrl||a.href;if(depart(url)){e.preventDefault();e.stopImmediatePropagation();}
  }
  // Ctrl/Cmd-click and the mouse wheel also need a source entry in the new tab.
  // Shift/Alt actions and links outside these three sites retain native behaviour.
  document.addEventListener('click',followLink,true);
  document.addEventListener('auxclick',followLink,true);
  function start() {
    decorate(document);
    new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1)decorate(n);});});}).observe(document.body,{childList:true,subtree:true});
    var p=null;
    try{p=JSON.parse(sessionStorage.getItem(PENDING)||'null');sessionStorage.removeItem(PENDING);}catch(e){}
    if(p&&p.from===location.href&&Date.now()-p.time<30000&&siteFor(p.to)&&siteFor(p.to)!==siteFor(location.href)){
      try{sessionStorage.setItem(RETURN,JSON.stringify(p.state));root.opener=null;}catch(e){}
      restore(p.state);
      timer=setTimeout(function(){timer=null;location.assign(p.to);},2000);
    } else {
      try{var state=JSON.parse(sessionStorage.getItem(RETURN)||'null');if(state&&state.url===location.href){sessionStorage.removeItem(RETURN);restore(state);}}catch(e){}
    }
  }
  root.addEventListener('pagehide',function(){if(timer){clearTimeout(timer);timer=null;}});
  root.addEventListener('pageshow',function(e){if(e.persisted){
    if(timer){clearTimeout(timer);timer=null;}
    try{
      sessionStorage.removeItem(PENDING);
      // BFCache already restored the live page. Consume its snapshot so a later
      // reload cannot overwrite a new query with the old departure state.
      var state=JSON.parse(sessionStorage.getItem(RETURN)||'null');
      if(state&&state.url===location.href)sessionStorage.removeItem(RETURN);
    }catch(err){}
  }});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
