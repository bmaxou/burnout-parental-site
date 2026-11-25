/* Run with node _build/test_recherche.cjs after building. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const engine=require('../assets/recherche-moteur.js');
const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/index-recherche.json'),'utf8'));
const firstCases=[
 ['burnout parental','/comprendre.html'],['burn-out parental','/comprendre.html'],
 ['épuisement parental','/comprendre.html'],['burnout','/comprendre.html'],
 ['test','/auto-tests.html'],['questionnaires','/auto-tests.html'],
 ['test burnout parental','/test-burnout-parental.html'],
 ['sommeil','/signes-symptomes.html'],['insomnie','/signes-symptomes.html'],
 ['je ne dors plus','/signes-symptomes.html'],['je suis à bout','/signes-symptomes.html'],
 ['RDV','/#rdv'],['rendez-vous','/#rdv'],['prendre rdv','/#rdv'],
 ['maman épuisée','/mere-epuisee.html'],['papa','/pere-epuise.html'],
 ['parent seul','/parent-solo.html'],['belle mère','/famille-recomposee.html'],
 ['handicap','/enfant-besoins-specifiques.html'],['TDAH','/enfant-besoins-specifiques.html'],
 ['post partum','/perinatalite-post-partum.html'],['baby blues','/perinatalite-post-partum.html'],
 ['BR²','/test-risques-ressources.html'],['EMDR','/approches-therapeutiques.html'],
 ['TCC','/approches-therapeutiques.html'],['dépression','/burnout-parental-depression-fatigue.html'],
 ['burnout professionnel','/burnout-parental-et-professionnel.html'],
 ['PBA','/glossaire.html#terme-pba'],['PBI','/glossaire.html#terme-pbi'],
 ['MBI','/glossaire.html#terme-mbi'],['coparentalité','/test-coparentalite.html'],
 ['prévention','/prevention-au-quotidien.html'],['fatgue','/burnout-parental-depression-fatigue.html'],
 ['épuisement','/comprendre.html'],['fatig','/burnout-parental-depression-fatigue.html'],['depresion','/burnout-parental-depression-fatigue.html'],
 ['culpabilité','/consequences-enfant-couple.html'],['consulter','/quand-consulter.html'],['psy','/quand-consulter.html'],
 ['maman seule','/mere-epuisee.html'],['charge mental','/test-charge-mentale.html']
];
for(const [query,wanted] of firstCases)assert.equal(engine.rank(rows,query)[0]?.url,wanted,query);
for(const query of ['Max Bouche','vertige','xyzznotaword'])assert.equal(engine.rank(rows,query).length,0,query+' must leave room for relevant network results');
assert.deepEqual(engine.rank(rows,'a'),[]);
assert(!rows.some(x=>/^\/tests\.html|coffre-|le-cabinet\.html/.test(x.url)),'no private or bridge pages indexed');
assert(rows.every(x=>!/[<>]/.test(x.title)),'plain-text titles');
assert(rows.every(x=>!/&(?:#\d+|#x[\da-f]+|nbsp|amp|quot|lt|gt);/i.test(x.title)),'decoded HTML entities in search titles');
const bodyOnly=[{url:'/incidental',title:'Un autre sujet',description:'',type:'page',text:'La fatigue apparaît au détour de cette phrase.'},{url:'/fatigue',title:'Fatigue',description:'',type:'dossier'}];
assert.equal(engine.rank(bodyOnly,'fatigue')[0].url,'/fatigue');
assert(engine.rank(rows,'je crie sur mes enfants').length>=3,'une phrase du quotidien trouve des réponses');
assert(engine.excerpt('La colère, puis la culpabilité.','colère').parts.some(p=>p.m&&p.t==='colère'),'extrait surligné');
console.log(`${firstCases.length+11} assertions de pertinence et d’exclusion réussies ; ${rows.length} entrées.`);
