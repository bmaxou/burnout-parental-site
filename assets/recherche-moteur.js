/* Recherche locale : titres, intentions et synonymes précèdent les mentions dans le texte. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BurnoutSearch=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function normalize(value){
    return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/burn[\s-]*out/g,'burnout').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  var stop=new Set('a au aux avec ce ces comment dans de des du en est et je la le les l ma me mes mon ne nos notre on ou par pas pour que quel quelle quels quelles qui qu sa se ses son suis sur un une vos votre vous'.split(' '));
  function terms(query){return normalize(query).split(' ').filter(function(t){return t&&!stop.has(t);});}
  function near(a,b){
    if(a===b)return true;
    if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
    var i=0,j=0,edits=0;
    while(i<a.length&&j<b.length){
      if(a[i]===b[j]){i++;j++;continue;}
      if(++edits>1)return false;
      if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
    }
    return edits+(i<a.length||j<b.length?1:0)<=1;
  }
  function contains(hay,needle){return (' '+hay+' ').indexOf(' '+needle+' ')!==-1;}
  function rank(rows,query,limit){
    var q=normalize(query),ts=terms(q);
    if(q.length<2||!ts.length)return [];
    var scored=[];
    rows.forEach(function(row,index){
      var title=normalize(row.title),aliases=(row.keywords||[]).map(normalize),description=normalize(row.description),headings=normalize(row.headings),body=normalize(row.text);
      var strong=[title].concat(aliases).join(' '),medium=description+' '+headings,all=strong+' '+medium+' '+body;
      var exactAlias=aliases.indexOf(q)!==-1,exactTitle=title===q;
      var allStrong=ts.every(function(t){return contains(strong,t);});
      var allMedium=ts.every(function(t){return contains(strong+' '+medium,t);});
      var allBody=ts.every(function(t){return contains(all,t);});
      var fuzzy=false;
      if(!allBody){
        var words=strong.split(' ');
        fuzzy=ts.every(function(t){return words.some(function(w){return near(t,w);});});
        if(!fuzzy)return;
      }
      var score=exactTitle?1200:exactAlias?1100:allStrong?560:allMedium?220:allBody?50:120;
      if(contains(title,q))score+=170;
      if(aliases.some(function(a){return contains(a,q);}))score+=80;
      if(ts.every(function(t){return contains(title,t);}))score+=95;
      if(row.type==='dossier'&&(exactAlias||exactTitle||allStrong))score+=100;
      if(row.type==='glossaire')score-=380;
      if(row.url==='/')score-=60;
      if(fuzzy)score=Math.min(score,160);
      // Several words scattered in a long article are not an adequate answer.
      if(score<100&&ts.length>1)return;
      scored.push({row:row,score:score,index:index});
    });
    scored.sort(function(a,b){return b.score-a.score||a.index-b.index;});
    // Keep incidental body matches below strong results, and avoid filling the list with them.
    if(scored.length&&scored[0].score>=500)scored=scored.filter(function(x){return x.score>=170;});
    return scored.slice(0,limit||8).map(function(x){return x.row;});
  }
  return {normalize:normalize,terms:terms,rank:rank};
});
