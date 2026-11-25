/* Moteur de recherche du site : racines françaises, synonymes, saisie partielle, fautes de frappe,
   pondération par champ (titre, mots-clés, intertitres, texte) et regroupement par page avec le passage le plus pertinent. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BurnoutSearch=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function normalize(value){
    return String(value||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae')
      .replace(/burn[\s-]*out/g,'burnout').replace(/[’']/g,' ').replace(/[^a-z0-9²]+/g,' ').replace(/²/g,'2').trim().replace(/\s+/g,' ');
  }
  var stop=new Set(('a au aux avec ce ces cet cette comment dans de des du en est et etre je j la le les l lui ma me mes mon ne n nos notre on ou par pas pour que quel quelle quels quelles qui qu sa se ses son suis sur un une vos votre vous il elle ils elles y d s c t m '+
    'quoi faire fait plus tres trop tout tous toute toutes mais donc car si sans sont ont ai as avoir leur leurs cela ca ici').split(' '));
  function terms(query){return normalize(query).split(' ').filter(function(t){return t&&!stop.has(t);});}
  // Racine française légère : retire les marques de pluriel, de féminin et quelques suffixes fréquents.
  var SUF=[['issements',4],['issement',4],['ements',4],['ement',4],['ations',4],['ation',4],['itions',4],['ition',4],['ites',4],['ite',4],['ables',4],['able',4],
    ['iques',4],['ique',4],['euses',4],['euse',4],['eux',4],['ives',4],['ive',4],['ifs',4],['if',4],['ees',4],['ee',4],['es',4],['er',4],['ez',4],['e',3],['s',3],['x',4]];
  var memo=new Map();
  function stem(w){
    if(memo.has(w))return memo.get(w);
    var r=w;
    if(w.length>3&&!/^\d+$/.test(w)){
      for(var i=0;i<SUF.length;i++){var s=SUF[i][0];if(r.length-s.length>=SUF[i][1]&&r.slice(-s.length)===s){r=r.slice(0,-s.length);break;}}
      if(r.length>4&&/(.)\1$/.test(r))r=r.slice(0,-1);
    }
    memo.set(w,r);return r;
  }
  // Groupes de synonymes et de mots du quotidien : chercher l'un trouve les autres.
  var GROUPS=[
    'burnout epuisement epuise epuisee bout craquer craque vide videe saturation surmenage',
    'fatigue fatigue fatiguee creve crevee lessive lessivee epuisant',
    'mere maman maternel maternelle mamans meres',
    'pere papa paternel paternelle papas peres',
    'enfant enfants fils fille gamin bambin progeniture',
    'bebe nourrisson naissance accouchement nouveau-ne',
    'adolescent ado ados adolescence adolescente',
    'couple conjoint conjointe mari epoux epouse compagnon compagne partenaire',
    'separation separe separee divorce divorcee rupture',
    'colere cris crier hurler enerve enervee irritabilite irritable agacement',
    'sommeil dormir dors insomnie nuit nuits reveil',
    'culpabilite coupable culpabiliser honte',
    'aide aider consulter consultation therapie therapeute psy psychotherapie accompagnement soutien',
    'rendez rdv doctolib reserver',
    'test tests questionnaire questionnaires quiz evaluation autoevaluation',
    'triste tristesse deprime deprimee depression cafard',
    'angoisse anxiete stress stresse stressee',
    'travail boulot emploi professionnel',
    'handicap handicape autisme autiste tsa tdah',
    'charge mentale',
    'solo seul seule monoparental monoparentale',
    'recomposee belle beau',
    'psychanalyse psychanalytique analytique analyste inconscient',
    'violence violent negligence maltraitance secoue',
    'prevenir prevention eviter'
  ].map(function(g){return g.split(' ').map(function(t){return stem(normalize(t));});});
  var SYN=new Map();
  GROUPS.forEach(function(g){g.forEach(function(t){var set=SYN.get(t)||new Set();g.forEach(function(u){if(u!==t)set.add(u);});SYN.set(t,set);});});
  function lev(a,b,max){
    if(Math.abs(a.length-b.length)>max)return max+1;
    var prev=[],cur=[],i,j;
    for(j=0;j<=b.length;j++)prev[j]=j;
    for(i=1;i<=a.length;i++){
      cur=[i];var best=i;
      for(j=1;j<=b.length;j++){
        var c=a[i-1]===b[j-1]?0:1;
        cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+c);
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])cur[j]=Math.min(cur[j],(prev2?prev2[j-2]:0)+1);
        if(cur[j]<best)best=cur[j];
      }
      if(best>max)return max+1;
      var prev2=prev;prev=cur;
    }
    return prev[b.length];
  }
  var FIELDS={title:7,keywords:6,headings:3,description:2.5,page:1.5,text:1};
  function tokens(v){return normalize(v).split(' ').filter(Boolean).map(stem);}
  var cache=new WeakMap();
  function prepare(rows){
    if(cache.has(rows))return cache.get(rows);
    var docs=[],df=new Map(),strongVocab=new Set(),vocab=new Set(),lens={},surface=new Map();
    rows.forEach(function(row,index){
      var d={row:row,index:index,f:{},len:{},phr:{}};
      Object.keys(FIELDS).forEach(function(k){
        var raw=k==='keywords'?(row.keywords||[]).join(' | '):(row[k]||'');
        var tk=tokens(raw),tf=new Map();
        tk.forEach(function(t){tf.set(t,(tf.get(t)||0)+1);vocab.add(t);if(k==='title'||k==='keywords'||k==='headings')strongVocab.add(t);});
        if(k==='title'||k==='keywords'||k==='headings')normalize(raw).split(' ').forEach(function(w){var st=stem(w);if(w&&!surface.has(st))surface.set(st,w);});
        d.f[k]=tf;d.len[k]=tk.length;d.phr[k]=' '+tk.join(' ')+' ';
        lens[k]=(lens[k]||0)+tk.length;
      });
      d.kw=(row.keywords||[]).map(normalize);d.ntitle=normalize(row.title);
      var seen=new Set();Object.keys(d.f).forEach(function(k){d.f[k].forEach(function(_,t){if(!seen.has(t)){seen.add(t);df.set(t,(df.get(t)||0)+1);}});});
      docs.push(d);
    });
    var avg={};Object.keys(lens).forEach(function(k){avg[k]=Math.max(1,lens[k]/rows.length);});
    var idx={docs:docs,df:df,N:rows.length,avg:avg,vocab:Array.from(vocab),strong:strongVocab,surface:surface};
    cache.set(rows,idx);return idx;
  }
  // Pour un mot de la requête : les mots de l'index qu'il désigne, avec un poids (exact 1, synonyme, début de mot, faute de frappe).
  function expand(idx,qt,isLast){
    var s=stem(qt),out=new Map();
    function add(t,w){if((out.get(t)||0)<w)out.set(t,w);}
    add(s,1);if(qt!==s)add(qt,1);
    (SYN.get(s)||[]).forEach(function(t){add(t,0.75);});
    var prefixOk=s.length>=3&&(isLast||s.length>=4),known=idx.df.has(s);
    idx.vocab.forEach(function(t){
      if(out.has(t))return;
      if(prefixOk&&t.length>s.length&&t.indexOf(s)===0){add(t,isLast?0.8:0.6);return;}
      if(s.length>=4&&!known&&idx.strong.has(t)){
        var max=s.length>=8?2:1;
        if(Math.abs(t.length-s.length)<=max&&lev(s,t,max)<=max)add(t,0.55);
      }
    });
    return out;
  }
  function rank(rows,query,limit){
    var q=normalize(query);
    if(q.length<2)return [];
    var ts=terms(q);
    if(!ts.length)ts=q.split(' ');
    var idx=prepare(rows),N=idx.N;
    var exp=ts.map(function(t,i){return expand(idx,t,i===ts.length-1);});
    var qstem=' '+ts.map(stem).join(' ')+' ';
    var hits=[];
    idx.docs.forEach(function(d){
      var score=0,matched=0,strongHits=0;
      exp.forEach(function(m){
        var best=0,strong=false;
        m.forEach(function(w,t){
          var n=idx.df.get(t);if(!n)return;
          var idf=Math.log(1+(N-n+0.5)/(n+0.5));
          Object.keys(FIELDS).forEach(function(k){
            var tf=d.f[k].get(t);if(!tf)return;
            var norm=tf*2.2/(tf+1.2*(0.25+0.75*d.len[k]/idx.avg[k]));
            var v=FIELDS[k]*norm*idf*w;
            if(v>best){best=v;strong=(k==='title'||k==='keywords'||k==='headings');}
          });
        });
        if(best>0){matched++;score+=best;if(strong)strongHits++;}
      });
      if(!matched)return;
      var cover=matched/exp.length;
      if(exp.length>1&&cover<1){if(exp.length<=2||cover<0.6)return;score*=cover*cover*0.6;}
      // Expressions exactes : titre, mots-clés, puis texte.
      if(d.kw.indexOf(q)!==-1)score=score*2.5+8;
      else if(d.kw.some(function(k){return (' '+k+' ').indexOf(' '+q+' ')!==-1;}))score*=1.3;
      if(d.ntitle===q&&d.row.type!=='glossaire')score=score*1.8+8;else if((' '+d.ntitle+' ').indexOf(' '+q+' ')!==-1)score*=1.25;
      if(ts.length>1){
        if(d.phr.title.indexOf(qstem)!==-1||d.phr.keywords.indexOf(qstem)!==-1)score*=1.5;
        else if(d.phr.headings.indexOf(qstem)!==-1)score*=1.3;
        else if(d.phr.text.indexOf(qstem)!==-1)score*=1.15;
      }
      if(strongHits===exp.length)score*=1.25;
      var type=d.row.type;
      if(type==='glossaire')score*=0.28;
      if(type==='dossier')score*=1.08;
      if(type==='section')score*=0.82;
      if(type==='faq')score*=0.9;
      if(d.row.url==='/')score*=0.6;
      if(d.row.url.indexOf('/bibliographie.html')===0)score*=0.6;
      if(d.row.url.indexOf('/reflexion-')===0)score*=0.9;
      hits.push({d:d,score:score,strong:strongHits});
    });
    // Une seule ligne par page : la page et son meilleur passage sont regroupés.
    var byPage=new Map();
    hits.forEach(function(h){
      var u=h.d.row.url,base=h.d.row.type==='section'?u.split('#')[0]:u;
      var g=byPage.get(base);
      if(!g){g={base:base,page:null,sec:null,score:0,index:h.d.index};byPage.set(base,g);}
      if(h.d.row.type==='section'){if(!g.sec||h.score>g.sec.score)g.sec=h;}
      else g.page=h;
    });
    var out=[];
    byPage.forEach(function(g){
      var ps=g.page?g.page.score:0,ss=g.sec?g.sec.score:0;
      var row,score;
      if(g.page&&(!g.sec||ps>=ss*0.6)){row=Object.assign({},g.page.d.row);score=ps+ss*0.25;if(g.sec&&g.sec.score>ps*0.35)row.passage={url:g.sec.d.row.url,title:g.sec.d.row.title,text:g.sec.d.row.text};}
      else if(g.sec){row=Object.assign({},g.sec.d.row);score=ss+ps*0.25;}
      else return;
      out.push({row:row,score:score,index:g.page?g.page.d.index:g.sec.d.index});
    });
    out.sort(function(a,b){return b.score-a.score||a.index-b.index;});
    if(!out.length)return [];
    var top=out[0].score;
    // Les mentions de passage, loin derrière les réponses directes, ne remplissent pas la liste.
    out=out.filter(function(x){return x.score>=top*0.08;});
    return out.slice(0,limit||8).map(function(x){return x.row;});
  }
  // Extrait : la fenêtre de texte la plus riche en mots cherchés, avec les mots repérés.
  function excerpt(text,query,size){
    var words=String(text||'').split(/\s+/),ts=terms(query).map(stem);
    if(!words.length||!ts.length)return {parts:[{t:String(text||'').slice(0,200),m:false}]};
    var flags=words.map(function(w){var s=stem(normalize(w).replace(/ /g,''));return ts.some(function(t){return s===t||(t.length>=3&&s.indexOf(t)===0)||(SYN.get(t)&&SYN.get(t).has(s));});});
    size=size||32;var best=0,bestAt=0,cur=0,i;
    for(i=0;i<words.length;i++){if(flags[i])cur++;if(i>=size&&flags[i-size])cur--;if(cur>best){best=cur;bestAt=Math.max(0,i-size+1);}}
    var start=best?Math.max(0,bestAt-4):0,end=Math.min(words.length,start+size);
    var parts=[];if(start>0)parts.push({t:'… ',m:false});
    for(i=start;i<end;i++){if(flags[i]){var mm=/^([«("]*)(.*?)([.,;:!?…»)"]*)$/.exec(words[i]);if(mm[1])parts.push({t:mm[1],m:false});parts.push({t:mm[2],m:true});if(mm[3])parts.push({t:mm[3],m:false});}else parts.push({t:words[i],m:false});parts.push({t:' ',m:false});}
    if(end<words.length)parts.push({t:'…',m:false});
    return {parts:parts,found:best>0};
  }
  function suggest(rows,query){
    // Correction proposée quand rien ne correspond : le mot du site le plus proche.
    var idx=prepare(rows),ts=terms(query),changed=false;
    var fixed=ts.map(function(t){
      if(t.length<4)return t;var s=stem(t),best=null,bd=3;
      idx.surface.forEach(function(w,v){if(v.length<4)return;var d=lev(s,v,2);if(d<bd){bd=d;best=v;}});
      if(best&&bd<=2&&best!==s){changed=true;return idx.surface.get(best);}return t;
    });
    return changed?fixed.join(' '):'';
  }
  return {normalize:normalize,terms:terms,stem:stem,rank:rank,excerpt:excerpt,suggest:suggest};
});
