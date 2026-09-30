(function(){const CL=window.CL=window.CL||{};
const S=()=>CL.store.get(),D=()=>CL.data,regionOf=id=>D().REGIONS.find(r=>r.id===id);
const uid=p=>CL.util&&CL.util.uid?CL.util.uid(p):p+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const bpOf=inc=>{const id=S().plan[inc.id];return id?D().BLUEPRINTS.find(b=>b.id===id):null};
const priorityScore=(i,r)=>{r=r||regionOf(i.regionId);return r?i.urgency*r.density/r.idi:0};
const regionScore=id=>Math.max(0,...S().incidents.filter(i=>i.regionId===id).map(i=>priorityScore(i)));
const effectiveCost=i=>{const b=bpOf(i);return i.estCost*(1-(b?b.savingPct:0))};
function allocateBudget(budget){const s=S();let rem=budget==null?s.budget:budget;const byId={};let used=0;
[...s.incidents].sort((a,b)=>priorityScore(b)-priorityScore(a)).forEach(i=>{const c=effectiveCost(i);
if(rem>=c){byId[i.id]={status:'funded',pct:1,funded:c,cost:c};rem-=c;used+=c}
else if(rem>0.01){byId[i.id]={status:'partial',pct:rem/c,funded:rem,cost:c};used+=rem;rem=0}
else byId[i.id]={status:'deferred',pct:0,funded:0,cost:c}});return{byId,used,remaining:rem}}
function metrics(){const s=S(),a=allocateBudget(),tot=s.incidents.reduce((x,i)=>x+i.clusterSize,0),m=s.incidents.length;
return{citizensImpacted:Math.round(s.incidents.reduce((x,i)=>x+i.clusterSize*1200*(a.byId[i.id]?a.byId[i.id].pct:0),0)),
activeHotspots:s.incidents.filter(i=>i.urgency>=7).length,budgetUtilization:s.budget>0?a.used/s.budget*100:0,
aiEfficiency:tot?(1-m/tot)*100:0,totalReports:tot,masterCount:m}}
const tok=t=>new Set(String(t||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>1));
function similarity(a,b){const A=tok(a),B=tok(b);if(!A.size||!B.size)return 0;let n=0;A.forEach(w=>B.has(w)&&n++);return n/(A.size+B.size-n)}
// keyword table: [category, english gloss, regex over any supported language]
const KW=[['Water','water',/water|पानी|水|água|agua|amanzi|вод[аыу]|ماء|مياه|ውሃ|\bair\b|banjir/i],
['Water','pipe',/pipe|पाइप|管|cano|umsele|труб|ماسورة|ቧንቧ|pipa/i],['Water','flooding',/flood|बाढ़|洪|enchente|banjir|наводн|فيضان|ጎርፍ/i],
['Sanitation','sewage',/sewage|sewer|नाला|污水|esgoto|сточ|صرف|ፍሳሽ/i],
['Roads','road',/road|सड़क|路|rua\b|estrada|avenida|дорог|طريق|መንገድ|jalan|street/i],['Roads','pothole',/pothole|buraco|गड्ढ|坑|яма|lubang/i],
['Power','electricity',/power|electric|बिजली|电|\bluz\b|energia|ugesi|электр|свет|كهرباء|ኤሌክትሪክ|listrik|blackout/i],['Power','lighting',/light|灯|лампы|lampu/i],
['Power','heating',/heat|отоплен|暖|تدفئة/i],
['Waste','garbage',/garbage|waste|कचरा|垃圾|lixo|udoti|мусор|قمامة|نفايات|ቆሻሻ|sampah/i],
['Transit','bus',/\bbus\b|बस|公交|ônibus|onibus|автобус|حافلة|አውቶብስ|bis\b/i],['Transit','metro',/metro|train|मेट्रो|地铁|trem|поезд|قطار|ባቡር|kereta/i]];
const NEG=/burst|danger|cold|dark|leak|flood|no water|nobody|terrible|broken|blackout|smell|overflow|unsafe|not receding|has been cut|risk|फट|खतरा|危险|perigo|ninguém|опас|холодно|خطر|ስጋት|bahaya|ውሃ የለም|amanzi awasenzi/i;
const POS=/thank|good job|great|fixed|obrigado|धन्यवाद|谢谢|спасибо|شكرا|አመሰግናለሁ|terima kasih|ngiyabonga/i;
const URG=[[/burst|फट/i,2],[/danger|unsafe|خطر|危险|perigo|опас/i,2],[/child|children|kids|طفل|أطفال/i,1.5],[/hospital|clinic|school/i,2],[/fire|smoke/i,2],[/flood|banjir|ጎርፍ/i,1.5],
[/days|week|for two|three days|izinsuku|неделю|tiga hari|ቀናት/i,1],[/cold|холодно/i,1.5],[/urgent|emergency|ngokushesha|immediately/i,1.5],[/nobody|no water|has been cut|not working|awasenzi|የለም/i,1]];
function script(t){return/[\u0900-\u097F]/.test(t)?['hi',97]:/[\u4e00-\u9fff]/.test(t)?['zh',97]:/[\u0400-\u04FF]/.test(t)?['ru',96]:/[\u0600-\u06FF]/.test(t)?['ar',96]:/[\u1200-\u137F]/.test(t)?['am',97]:
/amanzi|awasenzi|izinsuku|sidinga|ngokushesha|ugesi/i.test(t)?['zu',92]:/\b(não|buraco|avenida|água|ninguém|há|lixo|rua)\b/i.test(t)?['pt',92]:
/\b(banjir|kami|tidak|sampah|listrik|sudah|jalan)\b/i.test(t)?['id',91]:null}
function quick(text,hint){const L=D().LANGUAGES,t=String(text||'').trim(),ex=L.find(l=>l.sample===t);let det,conf;
if(ex){det=ex.code;conf=99}else{const s=script(t);if(s){det=s[0];conf=s[1]}else if(/^[\x00-\x7F\s]+$/.test(t)&&/\b(the|is|has|not|and|for|water|road|power)\b/i.test(t)){det='en';conf=90}else{det=hint||'en';conf=65}}
let en;if(ex)en=ex.sampleEnglish;else if(det==='en')en=t;else{const g=[...new Set(KW.filter(k=>k[2].test(t)).map(k=>k[1]))];en=g.length?'Citizen report (gist): '+g.join(', '):'Citizen report (machine gist): '+t}
const all=t+' '+en,sc={};KW.forEach(k=>{if(k[2].test(all))sc[k[0]]=(sc[k[0]]||0)+1});
const category=Object.keys(sc).sort((a,b)=>sc[b]-sc[a])[0]||(ex?ex.category:'Roads');
const sentiment=POS.test(all)&&!NEG.test(all)?'Positive':NEG.test(all)?'Negative':'Neutral';
let u=3+(/^(Water|Power|Sanitation)$/.test(category)?1:0);URG.forEach(x=>{if(x[0].test(all))u+=x[1]});
const letters=t.replace(/[^A-Za-z]/g,'');if(letters.length>8&&letters===letters.toUpperCase())u+=1;u+=Math.min(1,(t.match(/!/g)||[]).length*.5);
const lg=L.find(l=>l.code===det);
return{detectedLang:det,langName:lg?lg.name:det,confidence:conf,english:en,sentiment,urgency:Math.max(1,Math.min(10,Math.round(u))),category}}
const STEPS=['Detecting language','Translating to English','Analysing sentiment','Scoring urgency'];
async function analyzeReport(o){o=o||{};const w=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<4;i++){if(typeof o.onStep==='function')try{o.onStep(i,STEPS[i])}catch(e){}await w(500)}
const r=quick(o.text,o.langHint);r.steps=STEPS.slice();if(typeof o.onStep==='function')try{o.onStep(4,'Done')}catch(e){}return r}
const COST={Water:15,Power:14,Roads:9,Waste:6,Transit:10,Sanitation:14};
const slaFor=u=>u>=9?24:u>=7?36:u>=5?72:96;
function ingestReport(o){const an=o.analysis||quick(o.text,o.lang),reg=regionOf(o.regionId);let out={incidentId:null,merged:false};
CL.store.update(s=>{const rep={id:uid('rep'),name:o.name||'Anonymous',phone:o.phone||'',lang:an.detectedLang||o.lang||'en',originalText:o.text,englishText:an.english,sentiment:an.sentiment,urgency:an.urgency,ts:new Date().toISOString()};
let best=null,bs=0;s.incidents.filter(i=>i.regionId===o.regionId&&i.category===an.category).forEach(i=>{
let sc=similarity(i.title+' '+i.neighborhood+' '+i.reports.map(r=>r.englishText).join(' '),an.english);if(an.english.toLowerCase().includes(i.neighborhood.toLowerCase()))sc+=.5;if(sc>bs){bs=sc;best=i}});
if(best&&bs>=.15){best.clusterSize++;best.urgency=Math.max(best.urgency,an.urgency);best.reports.unshift(rep);best.reports=best.reports.slice(0,8);out={incidentId:best.id,merged:true}}
else{const id=uid('inc'),short=an.english.replace(/^Citizen report \((machine )?gist\):\s*/,'').slice(0,42);
s.incidents.unshift({id,regionId:o.regionId,title:an.category+' issue: '+short,neighborhood:'Citizen-reported zone',category:an.category,urgency:an.urgency,sentiment:an.sentiment,estCost:COST[an.category]||10,clusterSize:1,createdAt:new Date().toISOString(),slaHours:slaFor(an.urgency),reports:[rep]});out={incidentId:id,merged:false}}});
appendAudit('report',(out.merged?'Merged into ':'Created ')+out.incidentId+' ('+(reg?reg.name:o.regionId)+', '+an.category+', urgency '+an.urgency+')');return out}
function anonymizeText(str){let t=String(str==null?'':str);
t=t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g,'[EMAIL]').replace(/\+?\d[\d\s().-]{6,}\d/g,'[PHONE]').replace(/\b\d{6,}\b/g,'[ID]');
t=t.replace(/((?:I am|I'm|my name is|name:|this is)\s+)([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)/gu,'$1[NAME]');
try{const seen=new Set();S().incidents.forEach(i=>i.reports.forEach(r=>{if(r.name&&r.name.length>2)seen.add(r.name)}));
seen.forEach(n=>{t=t.split(n).join('[NAME]')})}catch(e){}return t}
const alias=n=>'Citizen-'+((String(n||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)*97)%900+100);
function maskReport(r,on){const c=Object.assign({},r);if(on===true){c.name=alias(r.name);c.phone='[REDACTED]';c.originalText=anonymizeText(r.originalText);c.englishText=anonymizeText(r.englishText)}return c}
function matchBlueprint(inc){const reg=regionOf(inc.regionId),sc=D().BLUEPRINTS.filter(b=>b.category===inc.category).map(b=>{const src=regionOf(b.fromRegionId),why=['Same category: '+b.category];let m=b.matchBase;
if(b.country!==reg.country){m+=3;why.push('Proven in '+src.name+' ('+b.country+'): cross-border transfer')}else{m-=10;why.push('Domestic blueprint (lower cross-border value)')}
const dd=Math.abs(Math.log(src.density/reg.density));if(dd<1){m+=Math.round((1-dd)*4);why.push('Comparable density ('+src.density+'k vs '+reg.density+'k per km²)')}
const di=Math.abs(src.idi-reg.idi);if(di<20){m+=Math.round((20-di)/10);why.push('Similar infrastructure maturity (IDI '+src.idi+' vs '+reg.idi+')')}
why.push('Saves ~'+Math.round(b.savingPct*100)+'% project cost, '+b.weeks+' weeks to deploy');return{blueprint:b,matchPct:Math.min(99,Math.max(40,m)),reasons:why}}).sort((a,b)=>b.matchPct-a.matchPct);
if(!sc.length)return{blueprint:null,matchPct:0,reasons:[],alternatives:[]};return{blueprint:sc[0].blueprint,matchPct:sc[0].matchPct,reasons:sc[0].reasons,alternatives:sc.slice(1,4)}}
function deployBlueprint(iid,bid){const inc=S().incidents.find(i=>i.id===iid);
CL.store.update(s=>{if(bid==null)delete s.plan[iid];else s.plan[iid]=bid});
appendAudit(bid==null?'undeploy':'deploy',(bid==null?'Removed blueprint from ':'Deployed '+bid+' to ')+(inc?inc.title:iid))}
function generateBrief(o){const an=!(o&&o.anonymize===false),s=S(),a=allocateBudget(),m=metrics(),f=n=>n.toFixed(1),L=[...s.incidents].sort((x,y)=>priorityScore(y)-priorityScore(x));
const st={funded:'Funded',partial:'Partially funded',deferred:'Deferred'};
let t='# Executive Strategic Infrastructure Brief\n_CivicLens BRICS · '+new Date().toISOString().slice(0,10)+' · Personal data '+(an?'anonymised':'NOT anonymised')+'_\n\n## Headline\n'+
'- **'+m.totalReports+'** citizen reports consolidated into **'+m.masterCount+'** master incidents ('+f(m.aiEfficiency)+'% duplicate noise removed)\n'+
'- Citizens impacted by funded work: **'+m.citizensImpacted.toLocaleString('en-US')+'**\n- Active hotspots (urgency ≥ 7): **'+m.activeHotspots+'**\n'+
'- Budget: **$'+s.budget+'M**, allocated **$'+f(a.used)+'M** ('+f(m.budgetUtilization)+'%)\n\n## Funding decisions (by Priority Score)\n| Score | Incident | Region | Reports | Urgency | Cost | Status |\n|---|---|---|---|---|---|---|\n';
L.forEach(i=>{const r=regionOf(i.regionId),x=a.byId[i.id];t+='| '+f(priorityScore(i))+' | '+i.title+' ('+i.neighborhood+') | '+r.name+' | '+i.clusterSize+' | '+i.urgency+'/10 | $'+f(effectiveCost(i))+'M | '+st[x.status]+(x.status==='partial'?' '+Math.round(x.pct*100)+'%':'')+' |\n'});
t+='\n## Regional profile\n';D().REGIONS.forEach(r=>{t+='- **'+r.name+', '+r.country+'**: density '+r.density+'k/km², IDI '+r.idi+', cap $'+r.budgetCap+'M, peak priority '+f(regionScore(r.id))+'\n'});
t+='\n## Deployed cross-border blueprints\n';const d=s.incidents.filter(i=>bpOf(i));
t+=d.length?d.map(i=>{const b=bpOf(i);return'- '+regionOf(i.regionId).name+': **'+b.title+'** (from '+b.country+') for '+i.title+', cost −'+Math.round(b.savingPct*100)+'%'}).join('\n'):'- None deployed yet.';
t+='\n\n## Sample citizen reports\n';L.slice(0,3).forEach(i=>{i.reports.slice(0,1).forEach(r=>{const k=maskReport(r,an);t+='- '+k.name+' / '+k.phone+': '+k.englishText+'\n'})});
return t+'\n## Methodology\nPriority Score = Urgency × Population Density (thousand/km²) ÷ IDI. Projects are funded in descending score order; the marginal project is partially funded. Similar reports in the same neighbourhood and category are clustered into one master incident.\n'+(an?'\n> All names, phone numbers, emails and ID numbers were removed before publication.\n':'\n> WARNING: this brief may contain personal data. Do not publish.\n')}
async function sha(str){try{if(crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){}
let h=5381,g=52711;for(let i=0;i<str.length;i++){h=(h*33^str.charCodeAt(i))>>>0;g=(g*31+str.charCodeAt(i))>>>0}return(h.toString(16).padStart(8,'0')+g.toString(16).padStart(8,'0')).repeat(4)}
const ZERO='0'.repeat(64);let q=Promise.resolve();
function appendAudit(type,msg){q=q.then(async()=>{const a=S().audit,prev=a.length?a[a.length-1].hash:ZERO,ts=new Date().toISOString(),hash=await sha(prev+'|'+ts+'|'+type+'|'+msg);
CL.store.update(s=>{s.audit.push({id:uid('aud'),ts,type,msg,hash,prevHash:prev})})}).catch(()=>{});return q}
async function verifyAudit(chain){const a=chain||S().audit;let prev=ZERO;
for(let i=0;i<a.length;i++){const e=a[i];if(e.prevHash!==prev)return{ok:false,brokenAt:i};const h=await sha(e.prevHash+'|'+e.ts+'|'+e.type+'|'+e.msg);if(h!==e.hash)return{ok:false,brokenAt:i};prev=e.hash}return{ok:true,brokenAt:null}}
CL.engines={priorityScore,regionScore,effectiveCost,allocateBudget,metrics,similarity,analyzeReport,ingestReport,anonymizeText,maskReport,matchBlueprint,deployBlueprint,generateBrief,appendAudit,verifyAudit,regionOf};
})();
