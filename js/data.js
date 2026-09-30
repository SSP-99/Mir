(function(){const CL=window.CL=window.CL||{};
const REGIONS=[
{id:'mumbai',name:'Mumbai',country:'India',cc:'IN',lat:19.08,lng:72.88,density:32,idi:58,budgetCap:180,population:20400000},
{id:'saopaulo',name:'São Paulo',country:'Brazil',cc:'BR',lat:-23.55,lng:-46.63,density:8,idi:74,budgetCap:220,population:12300000},
{id:'vladivostok',name:'Vladivostok',country:'Russia',cc:'RU',lat:43.12,lng:131.89,density:1.5,idi:66,budgetCap:90,population:600000},
{id:'shanghai',name:'Shanghai',country:'China',cc:'CN',lat:31.23,lng:121.47,density:3.8,idi:88,budgetCap:300,population:24900000},
{id:'joburg',name:'Johannesburg',country:'South Africa',cc:'ZA',lat:-26.2,lng:28.04,density:3,idi:52,budgetCap:110,population:5600000},
{id:'cairo',name:'Cairo',country:'Egypt',cc:'EG',lat:30.04,lng:31.24,density:19,idi:54,budgetCap:140,population:10000000},
{id:'addis',name:'Addis Ababa',country:'Ethiopia',cc:'ET',lat:9.03,lng:38.74,density:5.2,idi:45,budgetCap:80,population:5700000},
{id:'jakarta',name:'Jakarta',country:'Indonesia',cc:'ID',lat:-6.2,lng:106.85,density:16,idi:63,budgetCap:170,population:10600000}];
const CATEGORIES=['Water','Power','Roads','Waste','Transit','Sanitation'];
const rg=id=>REGIONS.find(r=>r.id===id);
const B=[
['Water','saopaulo','Deep-well rainwater harvesting network','Modular cisterns and infiltration wells cut peak mains demand by a third across 14 districts.',.22,26,90,['rainwater','resilience']],
['Water','shanghai','Acoustic smart leak-detection grid','Pipe-mounted sensors locate leaks within 2 m and cut non-revenue water by 27%.',.18,14,88,['sensors','iot']],
['Water','cairo','Smart pressure-zoning valves','District metering and automated valves stabilise pressure in dense low-rise areas.',.15,12,84,['pressure','metering']],
['Power','shanghai','Neighbourhood microgrid with storage','Islandable microgrids with battery buffers keep critical loads live during faults.',.20,20,89,['microgrid','storage']],
['Power','mumbai','Rooftop solar mini-grid co-ops','Resident co-ops sell surplus solar to the grid and cut outage hours by 41%.',.24,16,87,['solar','community']],
['Power','vladivostok','District-heat predictive maintenance','Thermal-drift models flag pipe failures nine days before rupture.',.17,10,85,['heating','predictive']],
['Roads','shanghai','Recycled-asphalt rapid-patch protocol','Hot-in-place recycling patches potholes in 40 minutes at 60% lower cost.',.25,8,90,['asphalt','rapid']],
['Roads','joburg','Community pothole-crew model','Trained local crews dispatched from a citizen ticket queue; 72 h median fix.',.20,6,84,['community','crews']],
['Roads','saopaulo','Road-surface scanning from city buses','Bus-mounted cameras map surface damage weekly for targeted repairs.',.16,10,82,['ai-vision','maintenance']],
['Waste','cairo','Neighbourhood waste-to-energy plants','Small-scale gasification turns mixed waste into district power and heat.',.21,28,86,['energy','circular']],
['Waste','mumbai','Decentralised biogas composting','Ward-level digesters turn organic waste into cooking gas and cut hauling by 38%.',.21,9,88,['biogas','compost']],
['Waste','saopaulo','Cooperative recycler network','Formalised waste-picker cooperatives with optimised routes and fair pay.',.19,12,85,['recycling','livelihoods']],
['Transit','saopaulo','BRT corridor with integrated fares','Dedicated lanes and tap-to-pay integration lifted corridor capacity by 45%.',.20,30,89,['brt','fares']],
['Transit','shanghai','Adaptive headway dispatch AI','Demand-driven spacing of trains and buses relieves peak crowding without new fleet.',.16,8,90,['ai','scheduling']],
['Transit','addis','Light-rail feeder bus network','Timed feeder routes double station catchment areas at low cost.',.18,14,83,['feeder','rail']],
['Sanitation','jakarta','Tidal-flood pumping and retention ponds','Pump stations with retention ponds cleared street flooding within hours.',.22,32,87,['flood','pumps']],
['Sanitation','joburg','Community sewer-blockage monitoring','Low-cost level sensors alert crews before sewage overflows reach homes.',.17,10,84,['sewer','sensors']],
['Sanitation','addis','Container-based sanitation loops','Sealed toilets with scheduled collection and reuse serve unsewered blocks.',.19,12,83,['reuse','low-cost']]];
const BLUEPRINTS=B.map((b,i)=>({id:'bp-'+(i+1),category:b[0],fromRegionId:b[1],country:rg(b[1]).country,title:b[2],summary:b[3],savingPct:b[4],weeks:b[5],matchBase:b[6],tags:b[7]}));
const LANGUAGES=[
{code:'hi',name:'Hindi',sample:'हमारे इलाके में पानी की पाइपलाइन फट गई है, सड़क पर पानी बह रहा है',sampleEnglish:"Our area's water pipeline has burst; water is flowing onto the street",category:'Water'},
{code:'zh',name:'Mandarin',sample:'我们小区的路灯全部熄灭了，晚上非常危险',sampleEnglish:'All streetlights in our compound are out; it is very dangerous at night',category:'Power'},
{code:'pt',name:'Portuguese',sample:'Há um buraco enorme na avenida e ninguém conserta',sampleEnglish:'There is a huge pothole on the avenue and nobody repairs it',category:'Roads'},
{code:'zu',name:'Zulu',sample:'Amanzi awasenzi izinsuku ezintathu, sidinga usizo ngokushesha',sampleEnglish:'There has been no water for three days; we urgently need help',category:'Water'},
{code:'ru',name:'Russian',sample:'Отопление не работает уже неделю, в доме очень холодно',sampleEnglish:'Heating has not worked for a week; the house is very cold',category:'Power'},
{code:'ar',name:'Arabic',sample:'الكهرباء مقطوعة في حينا منذ يومين والأطفال في خطر',sampleEnglish:'Electricity has been cut in our neighbourhood for two days and children are at risk',category:'Power'},
{code:'am',name:'Amharic',sample:'ለሦስት ቀናት ውሃ የለም፤ እባካችሁ እርዱን',sampleEnglish:'There has been no water for three days; please help us',category:'Water'},
{code:'id',name:'Indonesian',sample:'Banjir di jalan kami sudah tiga hari, air tidak surut',sampleEnglish:'Flooding on our street for three days; the water is not receding',category:'Sanitation'},
{code:'en',name:'English',sample:'Garbage has not been collected for two weeks and it smells terrible',sampleEnglish:'Garbage has not been collected for two weeks and it smells terrible',category:'Waste'}];
const RL={mumbai:'hi',saopaulo:'pt',vladivostok:'ru',shanghai:'zh',joburg:'zu',cairo:'ar',addis:'am',jakarta:'id'};
const NAMES={mumbai:['Asha Verma','Rohit Patil','Sunita Rao','Imran Shaikh'],saopaulo:['Lucas Martins','Ana Souza','Bruno Lima','Carla Dias'],vladivostok:['Olga Petrova','Dmitri Volkov','Irina Sokolova','Pavel Orlov'],shanghai:['Wei Zhang','Li Na','Chen Hao','Wang Fang'],joburg:['Thabo Nkosi','Sipho Dlamini','Lerato Mokoena','Zanele Khumalo'],cairo:['Omar Hassan','Mona Ali','Karim Nabil','Salma Youssef'],addis:['Abebe Bekele','Tigist Alemu','Dawit Tesfaye','Selam Haile'],jakarta:['Budi Santoso','Siti Rahma','Agus Wijaya','Dewi Lestari']};
const PH={IN:'+91 98xxx xxxxx',BR:'+55 11 9xxxx-xxxx',RU:'+7 914 xxx-xx-xx',CN:'+86 138 xxxx xxxx',ZA:'+27 82 xxx xxxx',EG:'+20 10 xxxx xxxx',ET:'+251 91 xxx xxxx',ID:'+62 812-xxxx-xxxx'};
const INC=[
['mumbai','Water main leak','Dharavi','Water',45,9,22,24],['mumbai','Monsoon drain flooding','Kurla','Sanitation',28,8,18,48],
['saopaulo','Pothole cluster on Av. Paulista','Bela Vista','Roads',28,6,9,72],['saopaulo','Recurring power outages','Guaianases','Power',19,7,14,36],
['vladivostok','Heating pipe failure','Pervaya Rechka','Power',22,8,12,24],['vladivostok','Bus route collapse','Egersheld','Transit',11,5,6,96],
['shanghai','Metro overcrowding','Pudong','Transit',24,6,18,72],['shanghai','Uncollected waste','Minhang','Waste',9,4,5,96],
['joburg','Load-shedding blackouts','Soweto','Power',38,9,26,24],['joburg','Sewage overflow','Alexandra','Sanitation',17,8,15,24],
['cairo','Water pressure loss','Shubra','Water',33,8,17,36],['cairo','Overflowing garbage','Imbaba','Waste',21,6,8,72],
['addis','Feeder bus shortage','Bole','Transit',15,5,10,96],['addis','Broken arterial road','Kirkos','Roads',26,7,13,72],
['jakarta','Flooded streets','Penjaringan','Water',40,9,32,24],['jakarta','Pothole cluster','Tanah Abang','Roads',18,6,8,72]];
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function seedState(){const r=rng(20260930),now=Date.now();
const incidents=INC.map((x,i)=>{const [rid,title,hood,cat,n,u,cost,sla]=x,reg=rg(rid),L=LANGUAGES.find(l=>l.code===RL[rid]),nm=NAMES[rid];
const reports=Array.from({length:Math.min(8,n)},(_,k)=>({id:'rep-'+(i+1)+'-'+(k+1),name:nm[Math.floor(r()*nm.length)],phone:PH[reg.cc].replace(/x/g,()=>Math.floor(r()*10)),lang:L.code,originalText:L.sample,englishText:L.sampleEnglish+' ['+hood+']',sentiment:u>=6?'Negative':'Neutral',urgency:Math.max(1,Math.min(10,u+Math.floor(r()*3)-1)),ts:new Date(now-(k*3+i)*36e5).toISOString()}));
return{id:'inc-'+(i+1),regionId:rid,title,neighborhood:hood,category:cat,urgency:u,sentiment:u>=6?'Negative':'Neutral',estCost:cost,clusterSize:n,createdAt:new Date(now-((i*5)%40+2)*36e5).toISOString(),slaHours:sla,reports}});
return{budget:90,anonymize:true,selectedIssueId:null,activeTab:'command',incidents,plan:{},audit:[]}}
CL.data={REGIONS,BLUEPRINTS,LANGUAGES,CATEGORIES,seedState};
})();
