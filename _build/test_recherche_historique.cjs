/* Focused UI state tests without a browser; browser integration is verified separately. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../assets/recherche.js'),'utf8');
function fixture(initial={}){
  function element(id){return {id,value:'',open:false,isConnected:true,hidden:false,scrollTop:0,dataset:{},listeners:{},children:[],classList:{toggle(){}},
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
    emit(type,event={}){for(const fn of this.listeners[type]||[])fn(event);},
    focus(){},closest(){return null;},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},
    replaceChildren(){this.children=[];},appendChild(n){this.children.push(n);},append(...nodes){this.children.push(...nodes);},querySelectorAll(){return []}};}
  const ids=['bpSearchDialog','bpSearchInput','btnSearch','bpSearchResults','bpSearchStatus','bpSearchClose','glossSearch','glossEntries','glossCount','glossNetwork'];
  const nodes=Object.fromEntries(ids.map(id=>[id,element(id)]));
  const items=[element('emdr'),element('charge')];items[0].dataset.glossTerms='EMDR';items[1].dataset.glossTerms='Charge mentale';
  nodes.glossEntries.querySelectorAll=()=>items;
  const doc=element('document');doc.getElementById=id=>nodes[id];doc.querySelector=()=>null;doc.querySelectorAll=()=>[];doc.createElement=()=>element('new');doc.activeElement=nodes.btnSearch;
  const win=element('window');win.BurnoutSearch=require('../assets/recherche-moteur.js');
  const history={state:initial,backCalls:0,pushCalls:0,replaceState(state){this.state=state;},pushState(state){this.state=state;this.pushCalls++;},back(){this.backCalls++;}};
  const context={window:win,document:doc,history,location:{href:'https://burnout-parental.fr/glossaire.html',origin:'https://burnout-parental.fr',pathname:'/glossaire.html'},URL,Set,Math,Date,Promise,Array,Object,
    setTimeout(){return 1;},clearTimeout(){},fetch(){return Promise.resolve({ok:true,json:()=>Promise.resolve([])});}};
  vm.runInNewContext(code,context);return {nodes,items,doc,win,history};
}
const normal=fixture();normal.nodes.btnSearch.emit('click');assert(normal.nodes.bpSearchDialog.open);assert.equal(normal.history.pushCalls,1);
normal.nodes.bpSearchDialog.scrollTop=420;normal.nodes.bpSearchInput.value='sommeil';normal.nodes.bpSearchInput.emit('input');
assert.equal(normal.nodes.bpSearchDialog.scrollTop,0,'a new query reveals the first result in the scrolling dialog');
normal.nodes.bpSearchClose.emit('click');assert(!normal.nodes.bpSearchDialog.open);assert.equal(normal.history.backCalls,1);
normal.history.state={};normal.win.emit('popstate');assert(!normal.nodes.bpSearchDialog.open);
const clone=fixture({bpSearch:true,bpSearchQuery:'',bpSearchEntry:'copied-from-another-tab'});clone.win.emit('pageshow');assert(clone.nodes.bpSearchDialog.open);
clone.nodes.bpSearchDialog.scrollTop=210;clone.win.emit('pageshow');clone.doc.emit('cabinet:restore');
assert.equal(clone.nodes.bpSearchDialog.scrollTop,210,'restoring Back or a network snapshot does not reset the dialog position');
clone.nodes.bpSearchClose.emit('click');assert(!clone.nodes.bpSearchDialog.open);assert.equal(clone.history.backCalls,0);assert.equal(clone.history.state.bpSearch,false);
clone.doc.emit('cabinet:restore');assert(!clone.nodes.bpSearchDialog.open,'a voluntarily closed copied dialog stays closed');
const glossary=fixture();glossary.nodes.glossSearch.value='EMDR';glossary.nodes.glossSearch.emit('input');assert.equal(glossary.history.state.bpGlossQuery,'EMDR');
const departure={detail:{}};glossary.doc.emit('cabinet:before-leave',departure);assert.equal(departure.detail.history.bpGlossQuery,'EMDR');
glossary.nodes.glossSearch.value='';glossary.doc.emit('cabinet:restore');assert.equal(glossary.nodes.glossSearch.value,'EMDR');assert(!glossary.items[0].hidden);assert(glossary.items[1].hidden);
glossary.history.state={bpGlossQuery:''};glossary.win.emit('popstate');assert.equal(glossary.nodes.glossSearch.value,'');assert(glossary.items.every(item=>!item.hidden));
console.log('Historique : fermeture normale, copie intersite, retour volontaire et restauration du glossaire réussis.');
