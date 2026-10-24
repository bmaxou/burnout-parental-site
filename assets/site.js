/* burnout-parental.fr : script commun à toutes les pages.
   Aucune donnée saisie dans les auto-tests ne quitte le navigateur. */
(function(){
  'use strict';
  var html=document.documentElement;
  html.classList.add('ds','js');
  var $=function(id){return document.getElementById(id);};
  function safeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function safeSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function reducedMotion(){
    if(html.getAttribute('data-motion')==='off') return true;
    try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}
  }

  /* ---- Lien de prise de rendez-vous (l'adresse n'est pas écrite dans le HTML) ---- */
  var RDV=atob('aHR0cHM6Ly93d3cuZG9jdG9saWIuZnIvcHN5Y2hvdGhlcmFwZXV0ZS9wYXJpcy9tYXgtYm91Y2hl');
  var RDV_LIEUX={colombes:'?pid=practice-597924',pavillons:'?pid=practice-670447',ardeche:'?pid=practice-597947',tele:'/booking/availabilities?specialityId=169&telehealth=true'};
  function setRdv(scope){ (scope||document).querySelectorAll('a[href^="#rdv"]').forEach(function(a){ var k=a.getAttribute('href').slice(5); a.href=RDV+(RDV_LIEUX[k]||''); a.target='_blank'; a.rel='noopener'; }); }
  setRdv();

  /* ---- Aperçu privé (retiré au lancement) ---- */
  var gate=$('gatescreen');
  if(gate){
    var gateInput=$('gatecode');
    function checkGate(){
      var v=gateInput.value.trim();
      if(v==='1024'){
        safeSet('bp_gate_ok','1');
        document.body.classList.remove('locked');
        gate.remove();
        document.querySelectorAll('[data-reveal]').forEach(function(el){el.classList.add('is-visible');});
        window.dispatchEvent(new Event('scroll'));
      } else { $('gateerr').textContent='Code incorrect.'; }
    }
    $('gatebtn').addEventListener('click',checkGate);
    gateInput.addEventListener('keydown',function(e){ if(e.key==='Enter') checkGate(); });
  }

  /* ---- Préférences d'affichage ---- */
  var savedTheme=safeGet('bp-theme'); if(savedTheme && savedTheme!=='auto') html.setAttribute('data-theme',savedTheme);
  var savedFs=safeGet('bp-fs'); if(savedFs) html.setAttribute('data-fs',savedFs);
  var savedSpacing=safeGet('bp-spacing'); if(savedSpacing==='on') html.setAttribute('data-spacing','on');
  var savedMotion=safeGet('bp-motion'); if(savedMotion==='off') html.setAttribute('data-motion','off');

  function setPressed(group,val,attr){
    group.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset[attr]===val ? 'true':'false'); });
  }
  var segFs=$('segFs');
  if(segFs){
    segFs.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b) return;
      var v=b.dataset.fs;
      if(v==='0') html.removeAttribute('data-fs'); else html.setAttribute('data-fs',v);
      safeSet('bp-fs', v==='0' ? '' : v);
      setPressed(segFs,v,'fs');
    });
    if(savedFs) setPressed(segFs,savedFs,'fs');
  }
  var segTheme=$('segTheme');
  if(segTheme){
    segTheme.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b) return;
      var v=b.dataset.theme;
      if(v==='auto') html.removeAttribute('data-theme'); else html.setAttribute('data-theme',v);
      safeSet('bp-theme',v);
      setPressed(segTheme,v,'theme');
    });
    setPressed(segTheme, savedTheme || 'auto','theme');
  }
  var swSpacing=$('swSpacing');
  if(swSpacing){
    swSpacing.setAttribute('aria-checked', savedSpacing==='on' ? 'true':'false');
    swSpacing.addEventListener('click',function(){
      var on=swSpacing.getAttribute('aria-checked')!=='true';
      if(on) html.setAttribute('data-spacing','on'); else html.removeAttribute('data-spacing');
      swSpacing.setAttribute('aria-checked', on?'true':'false'); safeSet('bp-spacing', on?'on':'off');
    });
  }
  var swMotion=$('swMotion');
  if(swMotion){
    swMotion.setAttribute('aria-checked', savedMotion==='off' ? 'true':'false');
    swMotion.addEventListener('click',function(){
      var off=swMotion.getAttribute('aria-checked')!=='true';
      if(off) html.setAttribute('data-motion','off'); else html.removeAttribute('data-motion');
      swMotion.setAttribute('aria-checked', off?'true':'false'); safeSet('bp-motion', off?'off':'on');
    });
  }

  /* ---- Panneaux latéraux (affichage, menu mobile) ---- */
  var scrim=$('scrim');
  var openPanelEl=null, lastFocus=null;
  function openPanel(panel,btn){
    closeAll();
    lastFocus=btn||document.activeElement;
    panel.classList.add('is-open'); if(scrim) scrim.classList.add('is-open');
    if(btn) btn.setAttribute('aria-expanded','true');
    openPanelEl=panel;
    var f=panel.querySelector('button,a,[tabindex]'); if(f) setTimeout(function(){f.focus();},60);
  }
  function closeAll(){
    if(openPanelEl){
      openPanelEl.classList.remove('is-open');
      var b=document.querySelector('[aria-controls="'+openPanelEl.id+'"]'); if(b) b.setAttribute('aria-expanded','false');
      openPanelEl=null;
      if(lastFocus && lastFocus.focus) lastFocus.focus();
    }
    if(scrim) scrim.classList.remove('is-open');
    closeShare(); closeNav();
  }
  var panel=$('a11yPanel'), btnA11y=$('btnA11y');
  if(panel && btnA11y){
    btnA11y.addEventListener('click',function(){ openPanel(panel,btnA11y); });
    var c=$('btnCloseA11y'); if(c) c.addEventListener('click',closeAll);
  }
  var mnav=$('mobileNav'), btnMenu=$('btnMenu');
  if(mnav && btnMenu){
    btnMenu.addEventListener('click',function(){ openPanel(mnav,btnMenu); });
    var cm=$('btnCloseMenu'); if(cm) cm.addEventListener('click',closeAll);
  }
  if(scrim) scrim.addEventListener('click',closeAll);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeAll(); });

  /* ---- Sous-menus de la navigation principale ---- */
  var navItems=document.querySelectorAll('.nav-item.has-sub');
  function closeNav(except){
    navItems.forEach(function(it){ if(it!==except){ it.classList.remove('is-open'); var b=it.querySelector('.nav-link'); if(b) b.setAttribute('aria-expanded','false'); } });
  }
  navItems.forEach(function(it){
    var btn=it.querySelector('.nav-link');
    var timer;
    var byHover=false;
    btn.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      if(it.classList.contains('is-open') && byHover){ byHover=false; return; } /* ouvert au survol : le clic le garde ouvert */
      var open=!it.classList.contains('is-open');
      closeNav(it);
      it.classList.toggle('is-open',open); btn.setAttribute('aria-expanded',open?'true':'false');
    });
    it.addEventListener('mouseenter',function(){ clearTimeout(timer); if(!it.classList.contains('is-open')){ closeNav(it); it.classList.add('is-open'); btn.setAttribute('aria-expanded','true'); byHover=true; } });
    it.addEventListener('mouseleave',function(){ timer=setTimeout(function(){ it.classList.remove('is-open'); btn.setAttribute('aria-expanded','false'); byHover=false; },220); });
    it.addEventListener('focusout',function(e){ if(!it.contains(e.relatedTarget)){ it.classList.remove('is-open'); btn.setAttribute('aria-expanded','false'); } });
  });
  document.addEventListener('click',function(e){ if(!e.target.closest('.nav-item.has-sub')) closeNav(); });

  /* ---- Partage ---- */
  var shareBtn=$('btnShare'), sharePop=$('sharePopover');
  function closeShare(){ if(sharePop){ sharePop.classList.remove('is-open'); shareBtn.setAttribute('aria-expanded','false'); } }
  var toast=$('toast'); var toastTimer;
  function showToast(msg){ if(!toast) return; toast.textContent=msg; toast.classList.add('is-open'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){toast.classList.remove('is-open');},2200); }
  if(shareBtn && sharePop){
    shareBtn.addEventListener('click',function(e){
      e.stopPropagation();
      if(navigator.share){ navigator.share({title:document.title,url:location.href}).catch(function(){}); return; }
      var open=sharePop.classList.toggle('is-open'); shareBtn.setAttribute('aria-expanded',open?'true':'false');
    });
    document.addEventListener('click',function(e){ if(!sharePop.contains(e.target) && e.target!==shareBtn) closeShare(); });
    $('btnCopyLink').addEventListener('click',function(){
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function(){showToast('Lien copié');},function(){showToast('Copie impossible sur cet aperçu');});
      closeShare();
    });
    $('btnPrint').addEventListener('click',function(){ closeShare(); window.print(); });
  }

  /* ---- Lecture audio (Web Speech API) ---- */
  var synth=window.speechSynthesis;
  var apBtn=$('btnAudio'), player=$('audioPlayer');
  if(apBtn && player){
    var playPause=$('apPlayPause'), apIcon=$('apIcon'), apStop=$('apStop');
    var paras=Array.prototype.slice.call(document.querySelectorAll('#contenu h1, #contenu h2, #contenu h3, #contenu p, #contenu li, #contenu dt, #contenu dd, #contenu legend'))
      .filter(function(el){ return !el.closest('.quiz-result') && !el.closest('.crumbs'); });
    var idx=0, speaking=false, paused=false;
    var PAUSE='<rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>', PLAY='<polygon points="6 3 20 12 6 21 6 3"/>';
    function clearHighlight(){paras.forEach(function(p){p.classList.remove('is-reading');});}
    function speakFrom(i){
      if(!synth){ showToast('Lecture vocale non disponible sur ce navigateur'); return; }
      if(i>=paras.length){ stopReading(); return; }
      idx=i; clearHighlight();
      var el=paras[i]; el.classList.add('is-reading'); el.scrollIntoView({block:'center',behavior: reducedMotion() ? 'auto':'smooth'});
      var u=new SpeechSynthesisUtterance(el.textContent); u.lang='fr-FR';
      u.onend=function(){ if(speaking && !paused) speakFrom(i+1); };
      synth.speak(u);
    }
    function startReading(){ speaking=true; paused=false; player.classList.add('is-open','is-playing'); document.body.classList.add('audio-on'); apBtn.setAttribute('aria-pressed','true'); apIcon.innerHTML=PAUSE; speakFrom(0); }
    function pauseReading(){ paused=true; speaking=false; if(synth) synth.cancel(); player.classList.remove('is-playing'); apIcon.innerHTML=PLAY; }
    function resumeReading(){ speakFrom(idx); speaking=true; paused=false; player.classList.add('is-playing'); apIcon.innerHTML=PAUSE; }
    function stopReading(){ speaking=false; paused=false; if(synth) synth.cancel(); clearHighlight(); idx=0; player.classList.remove('is-open','is-playing'); document.body.classList.remove('audio-on'); apBtn.setAttribute('aria-pressed','false'); apIcon.innerHTML=PLAY; }
    apBtn.addEventListener('click',function(){ if(!speaking && !paused) startReading(); else if(speaking) pauseReading(); else resumeReading(); });
    playPause.addEventListener('click',function(){ if(speaking) pauseReading(); else resumeReading(); });
    apStop.addEventListener('click',stopReading);
    window.addEventListener('pagehide',function(){ if(synth) synth.cancel(); });
  }

  /* ---- Visuels animés (anneaux, barres, jauges) : lancés quand visibles ---- */
  function playVisuals(scope){
    scope.querySelectorAll('.ring .fill[data-target], .g-fill[data-target]').forEach(function(el){ el.style.setProperty('--c', el.getAttribute('data-target')); });
    scope.querySelectorAll('.g-needle[data-angle]').forEach(function(el){ el.style.setProperty('--a', el.getAttribute('data-angle')+'deg'); });
    scope.querySelectorAll('.bar-fill[data-target]').forEach(function(el){ el.style.width=el.getAttribute('data-target')+'%'; });
    scope.querySelectorAll('.beam[data-tilt]').forEach(function(el){ el.style.setProperty('--t', el.getAttribute('data-tilt')+'deg'); });
    scope.querySelectorAll('.spark').forEach(function(el){ el.classList.add('is-on'); });
  }

  /* ---- Contenu protégé par mot de passe (déchiffré dans le navigateur, rien n'est envoyé) ---- */
  var vault=$('vault');
  if(vault && window.crypto && crypto.subtle){
    var vBtn=$('vaultBtn'), vForm=$('vaultForm'), vPwd=$('vaultPwd'), vMsg=$('vaultMsg');
    var raw=Uint8Array.from(atob(vault.getAttribute('data-vault')),function(c){return c.charCodeAt(0);});
    var salt=raw.slice(0,16), iv=raw.slice(16,28), ct=raw.slice(28);
    function ouvrir(mdp){
      var enc=new TextEncoder();
      return crypto.subtle.importKey('raw',enc.encode(mdp),'PBKDF2',false,['deriveKey']).then(function(k){
        return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:200000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['decrypt']);
      }).then(function(key){ return crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct); }).then(function(buf){
        var d=JSON.parse(new TextDecoder().decode(buf));
        var st=document.createElement('style'); st.textContent=d.css; document.head.appendChild(st);
        var main=$('contenu'); main.innerHTML=d.html;
        main.querySelectorAll('[data-reveal]').forEach(function(el){ el.classList.add('is-visible'); });
        try{ sessionStorage.setItem('bp_vault',mdp); }catch(e){}
        window.scrollTo(0,0);
      });
    }
    vBtn.addEventListener('click',function(){ var open=vForm.hidden; vForm.hidden=!open; vBtn.setAttribute('aria-expanded',open?'true':'false'); if(open) vPwd.focus(); });
    vForm.addEventListener('submit',function(e){
      e.preventDefault(); vMsg.textContent='';
      ouvrir(vPwd.value).catch(function(){ vMsg.textContent='Mot de passe incorrect'; vPwd.select(); });
    });
    var memo=null; try{ memo=sessionStorage.getItem('bp_vault'); }catch(e){}
    if(memo) ouvrir(memo).catch(function(){ try{ sessionStorage.removeItem('bp_vault'); }catch(e){} });
  }

  /* ---- Partage de la page (pied de page) : adresses construites au clic, rien dans le HTML ---- */
  var shareBox=$('footerShare');
  if(shareBox){
    var ICO={
      wa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>',
      mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
      li:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
      fb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
      cp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
    };
    function pageUrl(){ var c=document.querySelector('link[rel="canonical"]'); return (c&&c.href)||(location.origin+location.pathname); }
    /* gabarits de partage : seules adresses extérieures du site, jamais écrites dans les pages */
    var SHARE={
      wa:function(u,t){ return 'https://wa.me/?text='+t+'%20'+u; },
      li:function(u){ return 'https://www.linkedin.com/sharing/share-offsite/?url='+u; },
      fb:function(u){ return 'https://www.facebook.com/sharer/sharer.php?u='+u; }
    };
    var okEl=document.createElement('span'); okEl.className='ok'; okEl.setAttribute('aria-live','polite');
    function addBtn(key,label,fn){ var b=document.createElement('button'); b.type='button'; b.setAttribute('aria-label',label); b.title=label; b.innerHTML=ICO[key]; b.addEventListener('click',fn); shareBox.appendChild(b); }
    addBtn('wa','Partager par WhatsApp',function(){ window.open(SHARE.wa(encodeURIComponent(pageUrl()),encodeURIComponent(document.title)),'_blank','noopener'); });
    addBtn('mail','Partager par e-mail',function(){ location.href='mailto:?subject='+encodeURIComponent(document.title)+'&body='+encodeURIComponent(pageUrl()); });
    addBtn('li','Partager sur LinkedIn',function(){ window.open(SHARE.li(encodeURIComponent(pageUrl())),'_blank','noopener'); });
    addBtn('fb','Partager sur Facebook',function(){ window.open(SHARE.fb(encodeURIComponent(pageUrl())),'_blank','noopener'); });
    addBtn('cp','Copier le lien',function(){
      var fait=function(){ okEl.textContent='Lien copié'; showToast('Lien copié'); setTimeout(function(){okEl.textContent='';},2200); };
      try{ navigator.clipboard.writeText(pageUrl()).then(fait,fait); }catch(e){ fait(); }
    });
    shareBox.appendChild(okEl);
  }

  /* ---- Apparition au défilement ---- */
  var reveals=document.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window && !reducedMotion()){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('is-visible'); playVisuals(en.target); io.unobserve(en.target); } });
    },{threshold:.1,rootMargin:'0px 0px -5% 0px'});
    reveals.forEach(function(el){ io.observe(el); });
  } else { reveals.forEach(function(el){ el.classList.add('is-visible'); }); playVisuals(document); }

  /* ---- Compteurs animés ---- */
  function animateNumber(el,to,dur,fmt){
    if(reducedMotion()){ el.textContent=fmt(to); return; }
    var start=null;
    function step(ts){
      if(!start) start=ts;
      var p=Math.min(1,(ts-start)/dur); var e=1-Math.pow(1-p,3);
      el.textContent=fmt(to*e);
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters=document.querySelectorAll('[data-count]');
  if(counters.length){
    var startCounter=function(el){
      var to=parseFloat(el.getAttribute('data-count')); var dec=parseInt(el.getAttribute('data-decimals')||'0',10);
      var prefix=el.getAttribute('data-prefix')||'', suffix=el.getAttribute('data-suffix')||'';
      animateNumber(el,to,1600,function(v){ return prefix+v.toFixed(dec).replace('.',',')+suffix; });
      var box=el.closest('.counter'); if(box) box.classList.add('is-done');
    };
    if('IntersectionObserver' in window){
      var ioc=new IntersectionObserver(function(entries){ entries.forEach(function(en){ if(en.isIntersecting){ startCounter(en.target); ioc.unobserve(en.target);} }); },{threshold:.4});
      counters.forEach(function(el){ ioc.observe(el); });
    } else counters.forEach(startCounter);
  }

  /* ---- Sommaire : section courante ---- */
  var tocLinks=document.querySelectorAll('.toc a[href^="#"]');
  if(tocLinks.length && 'IntersectionObserver' in window){
    var map={};
    tocLinks.forEach(function(a){ var t=document.getElementById(a.getAttribute('href').slice(1)); if(t) map[t.id]=a; });
    var current=null;
    var ios=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ if(current) current.classList.remove('is-current'); current=map[en.target.id]; if(current) current.classList.add('is-current'); } });
    },{rootMargin:'-20% 0px -65% 0px'});
    Object.keys(map).forEach(function(id){ ios.observe(document.getElementById(id)); });
    var toc=document.querySelector('.toc');
    if(toc && window.innerWidth<1000){ toc.removeAttribute('open'); }
  }

  /* ---- En-tête, barre de progression, retour en haut ---- */
  var header=$('siteHeader'), bar=$('progressBar'), toTop=$('toTop');
  function onScroll(){
    var y=window.scrollY||document.documentElement.scrollTop;
    if(header) header.classList.toggle('is-scrolled', y>10);
    if(toTop) toTop.classList.toggle('is-visible', y>560);
    if(bar){ var h=document.documentElement.scrollHeight - window.innerHeight; bar.style.setProperty('--p', h>0 ? Math.min(1,y/h) : 0); }
  }
  document.addEventListener('scroll',onScroll,{passive:true}); onScroll();
  if(toTop) toTop.addEventListener('click',function(){ window.scrollTo({top:0, behavior: reducedMotion() ? 'auto':'smooth'}); });

  /* ---- Onde au clic sur les boutons ---- */
  document.addEventListener('click',function(e){
    var btn=e.target.closest('.btn'); if(!btn || reducedMotion()) return;
    var r=btn.getBoundingClientRect();
    var span=document.createElement('span'); span.className='ripple';
    span.style.left=(e.clientX-r.left-10)+'px'; span.style.top=(e.clientY-r.top-10)+'px'; span.style.width=span.style.height='20px';
    btn.appendChild(span); setTimeout(function(){span.remove();},650);
  });

  /* =====================================================================
     Moteur d'auto-tests. Tout est calculé localement, rien n'est envoyé.
     ===================================================================== */
  var SVG_WARN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>';
  var DEFAULT_SCALE=[{v:0,l:'Jamais'},{v:1,l:'Rarement'},{v:2,l:'Parfois'},{v:3,l:'Souvent'},{v:4,l:'Très souvent'}];
  var ALERT_HTML='<div class="qr-alert" role="alert"><div class="callout-icon">'+SVG_WARN+'</div><div><p><strong>Une ou plusieurs de vos réponses décrivent une situation qui mérite une aide rapide.</strong> Ce n\'est pas une faute : c\'est le signe que la charge dépasse ce qu\'une personne peut porter seule. N\'attendez pas que ça passe : prenez contact avec le cabinet dans les jours qui viennent. Il vous répondra sans jugement et pourra proposer un premier rendez-vous rapidement.</p>'+
    '<p style="margin:12px 0 0"><a class="btn btn-primary" href="#rdv" style="--bh:42px">Prendre contact avec le cabinet</a></p></div></div>';

  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function buildQuiz(root){
    var defEl=root.querySelector('script[type="application/json"]'); if(!defEl) return;
    var def; try{ def=JSON.parse(defEl.textContent); }catch(e){ return; }
    var qid=root.id || ('quiz'+Math.random().toString(36).slice(2,7));
    var scale=def.scale||DEFAULT_SCALE;
    var maxV=Math.max.apply(null,scale.map(function(s){return s.v;}));
    var minV=Math.min.apply(null,scale.map(function(s){return s.v;}));
    var qs=def.questions;
    var dims=def.dims||[];
    var answers=new Array(qs.length);

    var h='';
    h+='<div class="quiz-progress" aria-hidden="true"><div class="bar"><span></span></div><span class="count">0 / '+qs.length+'</span></div>';
    h+='<div class="quiz-body"><form novalidate>';
    qs.forEach(function(q,i){
      var sc=q.scale||scale;
      h+='<div class="q-item" data-i="'+i+'"><fieldset><legend><span class="q-num">'+(i+1)+'</span><span>'+esc(q.t)+'</span></legend>';
      h+='<div class="q-scale'+(sc.length===2?' binary':'')+'">';
      sc.forEach(function(s){
        var id=qid+'-q'+i+'-'+s.v;
        h+='<label for="'+id+'"><input type="radio" name="'+qid+'-q'+i+'" id="'+id+'" value="'+s.v+'"><span>'+esc(s.l)+'</span></label>';
      });
      h+='</div></fieldset></div>';
    });
    h+='<div class="quiz-actions"><button type="submit" class="btn btn-primary">'+esc(def.cta||'Voir mon résultat')+'</button><button type="button" class="btn btn-secondary q-reset">Recommencer</button><span class="hint" aria-live="polite"></span></div>';
    h+='</form></div><div class="quiz-result" aria-live="polite"></div>';
    var wrap=document.createElement('div'); wrap.innerHTML=h;
    root.appendChild(wrap);

    var form=root.querySelector('form'), barEl=root.querySelector('.quiz-progress .bar span'), countEl=root.querySelector('.quiz-progress .count'), hint=root.querySelector('.hint'), result=root.querySelector('.quiz-result');

    function updateProgress(){
      var n=answers.filter(function(a){return a!==undefined;}).length;
      barEl.style.width=(n/qs.length*100)+'%'; countEl.textContent=n+' / '+qs.length;
      if(n===qs.length) hint.textContent='';
    }
    form.addEventListener('change',function(e){
      var inp=e.target; if(inp.type!=='radio') return;
      var item=inp.closest('.q-item'); var i=parseInt(item.getAttribute('data-i'),10);
      answers[i]=parseInt(inp.value,10); item.classList.add('is-answered'); updateProgress();
      /* passe doucement à la question suivante */
      var next=item.nextElementSibling;
      if(next && next.classList.contains('q-item') && !next.classList.contains('is-answered') && !reducedMotion()){
        var r=next.getBoundingClientRect();
        if(r.bottom>window.innerHeight-40) next.scrollIntoView({block:'center',behavior:'smooth'});
      }
    });
    root.querySelector('.q-reset').addEventListener('click',function(){
      form.reset(); answers=new Array(qs.length);
      root.querySelectorAll('.q-item').forEach(function(it){it.classList.remove('is-answered');});
      result.classList.remove('is-open'); result.innerHTML=''; updateProgress();
      root.scrollIntoView({block:'start',behavior: reducedMotion()?'auto':'smooth'});
    });
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var missing=qs.map(function(_,i){return i;}).filter(function(i){return answers[i]===undefined;});
      if(missing.length){
        hint.textContent='Il reste '+missing.length+' question'+(missing.length>1?'s':'')+' sans réponse.';
        var first=root.querySelector('.q-item[data-i="'+missing[0]+'"]');
        first.scrollIntoView({block:'center',behavior: reducedMotion()?'auto':'smooth'});
        var inp=first.querySelector('input'); if(inp) inp.focus({preventScroll:true});
        return;
      }
      showResult();
    });

    function score(filter){
      var sum=0,max=0;
      qs.forEach(function(q,i){
        if(filter && !filter(q)) return;
        var sc=q.scale||scale; var mx=Math.max.apply(null,sc.map(function(s){return s.v;})), mn=Math.min.apply(null,sc.map(function(s){return s.v;}));
        var v=answers[i]; if(q.reverse) v=mx+mn-v;
        var w=q.w||1; sum+=v*w; max+=mx*w;
      });
      return {sum:sum,max:max,pct: max? Math.round(sum/max*100):0};
    }
    function levelFor(levels,pct){
      for(var i=0;i<levels.length;i++){ if(pct<=levels[i].max) return {lvl:levels[i],idx:i}; }
      return {lvl:levels[levels.length-1],idx:levels.length-1};
    }
    function ringHTML(pct,sub,color){
      var r=94, c=2*Math.PI*r;
      return '<div class="ring" style="--c:0"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="track" cx="110" cy="110" r="'+r+'"/><circle class="fill" cx="110" cy="110" r="'+r+'" style="'+(color?'stroke:'+color+';':'')+'" data-target="'+(pct/100*c).toFixed(1)+'"/></svg><div class="ring-label"><span class="ring-value" data-count="'+pct+'" data-suffix="%">0%</span><span class="ring-sub">'+esc(sub||'')+'</span></div></div>';
    }
    function gaugeHTML(pct,sub){
      /* demi-cercle de rayon 110 centré en (140,140) */
      var len=Math.PI*110;
      return '<div class="gauge"><svg viewBox="0 0 280 160" aria-hidden="true"><defs><linearGradient id="gaugeGrad" x1="0" x2="1"><stop offset="0" stop-color="#8FC1AD"/><stop offset=".55" stop-color="#D4AF37"/><stop offset="1" stop-color="#C96A4A"/></linearGradient></defs><path class="g-track" d="M30 140 A110 110 0 0 1 250 140"/><path class="g-fill" d="M30 140 A110 110 0 0 1 250 140" data-target="'+(pct/100*len).toFixed(1)+'"/><g class="g-needle" data-angle="'+(pct/100*180-90)+'"><line x1="140" y1="140" x2="140" y2="48" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="140" cy="140" r="7" fill="currentColor"/></g></svg><div class="g-value"><span data-count="'+pct+'" data-suffix="%">0%</span></div><div class="g-sub">'+esc(sub||'')+'</div></div>';
    }
    function barsHTML(rows){
      var h='<div class="bars">';
      rows.forEach(function(r){ h+='<div class="bar-row"><span class="bar-name">'+esc(r.label)+'</span><span class="bar-track"><span class="bar-fill" style="--bar-c:'+(r.color||'var(--c-moss)')+'" data-target="'+r.pct+'"></span></span><span class="bar-val"><span data-count="'+r.pct+'" data-suffix="%">0%</span></span></div>'; });
      return h+'</div>';
    }
    function balanceHTML(riskPct,resPct){
      var tilt=Math.max(-18,Math.min(18,(riskPct-resPct)/100*18));
      return '<div class="balance"><svg viewBox="0 0 340 200" aria-hidden="true"><rect x="162" y="70" width="16" height="110" rx="6" fill="var(--c-line-strong)"/><rect x="110" y="178" width="120" height="12" rx="6" fill="var(--c-line-strong)"/><g class="beam" data-tilt="'+tilt.toFixed(1)+'"><rect x="30" y="64" width="280" height="12" rx="6" fill="var(--c-ink-soft)"/><circle cx="170" cy="70" r="10" fill="var(--c-accent)"/><line x1="60" y1="70" x2="60" y2="118" stroke="var(--c-ink-faint)" stroke-width="2"/><line x1="280" y1="70" x2="280" y2="118" stroke="var(--c-ink-faint)" stroke-width="2"/><path class="pan pan-l" d="M20 118h80l-8 26H28z"/><path class="pan pan-r" d="M240 118h80l-8 26h-64z"/><text x="60" y="137" text-anchor="middle">Charges</text><text x="280" y="137" text-anchor="middle">Ressources</text></g></svg><div class="balance-legend"><span><i style="background:var(--c-accent)"></i>Charges '+riskPct+'%</span><span><i style="background:var(--c-moss)"></i>Ressources '+resPct+'%</span></div></div>';
    }
    function sparkHTML(values){
      /* courbe simple des réponses, dans l'ordre des questions */
      var W=420,H=120,p=12; var n=values.length; var pts=values.map(function(v,i){ return [p+i*(W-2*p)/Math.max(1,n-1), H-p-(v/maxV)*(H-2*p)]; });
      var d=pts.map(function(pt,i){ return (i?'L':'M')+pt[0].toFixed(1)+' '+pt[1].toFixed(1); }).join(' ');
      return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" aria-hidden="true"><path d="'+d+'"/>'+pts.map(function(pt){return '<circle cx="'+pt[0].toFixed(1)+'" cy="'+pt[1].toFixed(1)+'" r="3.5"/>';}).join('')+'</svg>';
    }

    function showResult(){
      var res=def.result||{type:'ring',levels:[]};
      var total=score();
      var dimScores=dims.map(function(d){ var s=score(function(q){return q.d===d.id;}); return {id:d.id,label:d.label,color:d.color,pct:s.pct,sum:s.sum,max:s.max}; });
      var risk=false;
      qs.forEach(function(q,i){ if(q.risk!==undefined && answers[i]>=q.risk) risk=true; });
      var lv, pct=total.pct, visual='', text='';
      if(res.type==='balance'){
        var rk=dimScores.filter(function(d){return d.id==='risk';})[0]||{pct:0}, rs=dimScores.filter(function(d){return d.id==='res';})[0]||{pct:0};
        pct=Math.round(50+(rk.pct-rs.pct)/2); /* 0 = que des ressources, 100 = que des charges */
        visual=balanceHTML(rk.pct,rs.pct);
        lv=levelFor(res.levels,pct);
      } else if(res.type==='profile'){
        var top=dimScores.slice().sort(function(a,b){return b.pct-a.pct;})[0];
        visual=barsHTML(dimScores);
        var found=res.levels.filter(function(l){return l.dim===top.id;})[0];
        lv={lvl:found||res.levels[0],idx:top.pct>=60?2:(top.pct>=35?1:0)};
        pct=top.pct;
      } else {
        lv=levelFor(res.levels,pct);
        if(res.type==='gauge') visual=gaugeHTML(pct,res.sub||'');
        else visual=ringHTML(pct,res.sub||'',lv.lvl.color);
        if(dims.length && res.bars!==false) visual+=barsHTML(dimScores);
        if(res.spark) visual+=sparkHTML(answers);
      }
      var lvlClass='l'+Math.min(4,lv.idx+1);
      text='<div class="qr-text"><span class="qr-level '+lvlClass+'">'+esc(lv.lvl.label)+'</span><h3>'+esc(lv.lvl.title||lv.lvl.label)+'</h3>'+(lv.lvl.html||'');
      if(res.dimNotes && dims.length){
        var notes=dimScores.filter(function(d){return d.pct>=(res.dimNoteMin||60) && res.dimNotes[d.id];}).map(function(d){return '<li><strong>'+esc(d.label)+' :</strong> '+res.dimNotes[d.id]+'</li>';});
        if(notes.length) text+='<p><strong>Ce qui ressort le plus chez vous :</strong></p><ul>'+notes.join('')+'</ul>';
      }
      text+='<p class="small" style="font-size:.8rem;color:var(--c-ink-faint)">Résultat calculé dans votre navigateur, non enregistré.</p>';
      text+='<div class="qr-actions">'+(res.links||[]).map(function(l){ return '<a class="btn '+(l.primary?'btn-primary':'btn-secondary')+'" href="'+esc(l.href)+'"'+'>'+esc(l.label)+'</a>'; }).join('')+'<button type="button" class="btn btn-secondary q-print">Imprimer mon résultat</button></div></div>';
      result.innerHTML='<div class="qr-grid"><div>'+visual+'</div>'+text+'</div>';
      if(risk) result.insertAdjacentHTML('afterbegin',ALERT_HTML);
      result.classList.add('is-open');
      result.querySelector('.q-print').addEventListener('click',function(){ window.print(); });
      setRdv(result);
      /* lance les animations après l'affichage */
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        playVisuals(result);
        result.querySelectorAll('[data-count]').forEach(function(el){
          var to=parseFloat(el.getAttribute('data-count')); var suffix=el.getAttribute('data-suffix')||'';
          animateNumber(el,to,1400,function(v){ return Math.round(v)+suffix; });
        });
      }); });
      result.scrollIntoView({block:'start',behavior: reducedMotion()?'auto':'smooth'});
      var hd=result.querySelector('h3'); if(hd){ hd.setAttribute('tabindex','-1'); setTimeout(function(){hd.focus({preventScroll:true});},700); }
    }
    updateProgress();
  }
  document.querySelectorAll('.quiz[data-quiz]').forEach(buildQuiz);
})();

/* Sections repliables des pages de réflexion : bouton « − » en bas à droite pour refermer */
(function(){
  document.querySelectorAll('.refl-article details.fold').forEach(function(d){
    var body=d.querySelector('.fold-body'); if(!body) return;
    var b=document.createElement('button');
    b.type='button'; b.className='fold-close'; b.setAttribute('aria-label','Replier cette section'); b.title='Replier'; b.textContent='\u2212';
    b.addEventListener('click',function(){
      d.open=false;
      var s=d.querySelector('summary'); if(s){ s.scrollIntoView({block:'center',behavior:'smooth'}); s.focus({preventScroll:true}); }
    });
    body.appendChild(b);
  });
})();
