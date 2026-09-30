// js/data.js
(function () {
  const CL = (window.CL = window.CL || {});

  const REGIONS = [
    {
      id: "mumbai",
      name: "Mumbai",
      country: "India",
      cc: "IN",
      lat: 19.076,
      lng: 72.8777,
      density: 21.0,
      idi: 54,
      budgetCap: 45,
      population: 20967000
    },
    {
      id: "saopaulo",
      name: "São Paulo",
      country: "Brazil",
      cc: "BR",
      lat: -23.5505,
      lng: -46.6333,
      density: 7.5,
      idi: 68,
      budgetCap: 40,
      population: 12396000
    },
    {
      id: "vladivostok",
      name: "Vladivostok",
      country: "Russia",
      cc: "RU",
      lat: 43.1155,
      lng: 131.8855,
      density: 1.8,
      idi: 76,
      budgetCap: 20,
      population: 603500
    },
    {
      id: "shanghai",
      name: "Shanghai",
      country: "China",
      cc: "CN",
      lat: 31.2304,
      lng: 121.4737,
      density: 8.9,
      idi: 88,
      budgetCap: 60,
      population: 27058000
    },
    {
      id: "joburg",
      name: "Johannesburg",
      country: "South Africa",
      cc: "ZA",
      lat: -26.2041,
      lng: 28.0473,
      density: 3.4,
      idi: 61,
      budgetCap: 30,
      population: 5635000
    },
    {
      id: "cairo",
      name: "Cairo",
      country: "Egypt",
      cc: "EG",
      lat: 30.0444,
      lng: 31.2357,
      density: 19.3,
      idi: 49,
      budgetCap: 35,
      population: 10100000
    },
    {
      id: "addis",
      name: "Addis Ababa",
      country: "Ethiopia",
      cc: "ET",
      lat: 9.03,
      lng: 38.74,
      density: 5.2,
      idi: 42,
      budgetCap: 25,
      population: 5228000
    },
    {
      id: "jakarta",
      name: "Jakarta",
      country: "Indonesia",
      cc: "ID",
      lat: -6.2088,
      lng: 106.8456,
      density: 14.4,
      idi: 58,
      budgetCap: 35,
      population: 10562000
    }
  ];

  const CATEGORIES = ["Water", "Power", "Roads", "Waste", "Transit", "Sanitation"];

  const BLUEPRINTS = [
    {
      id: "bp-water-sp",
      category: "Water",
      fromRegionId: "saopaulo",
      country: "Brazil",
      title: "Deep-Well Aquifer & Rain Harvesting Micro-Grids",
      summary: "Deploys modular subterranean storage tanks and filtration arrays to stabilize neighborhood pressure.",
      savingPct: 0.22,
      weeks: 14,
      matchBase: 88,
      tags: ["Resilience", "Subsurface", "Community-Managed"]
    },
    {
      id: "bp-water-sh",
      category: "Water",
      fromRegionId: "shanghai",
      country: "China",
      title: "Acoustic Leak Detection & Automated Pressure Valves",
      summary: "Uses IoT ultrasonic sensors across trunk mains to locate invisible underground pipe fractures.",
      savingPct: 0.25,
      weeks: 8,
      matchBase: 92,
      tags: ["IoT", "Sensors", "Preventative"]
    },
    {
      id: "bp-water-cairo",
      category: "Water",
      fromRegionId: "cairo",
      country: "Egypt",
      title: "Canal Silt Filtration & Secondary Ditch Reclamation",
      summary: "Combines mechanical silt traps with low-energy aeration beds for localized distribution safety.",
      savingPct: 0.18,
      weeks: 12,
      matchBase: 81,
      tags: ["High-Turbidity", "Filtration", "Low-Cost"]
    },
    {
      id: "bp-power-mum",
      category: "Power",
      fromRegionId: "mumbai",
      country: "India",
      title: "Rooftop Solar Co-ops & Micro-Inverter Grid Ingestion",
      summary: "Aggregates residential solar roofs into virtual power plants to ease peak distribution transformers.",
      savingPct: 0.24,
      weeks: 10,
      matchBase: 90,
      tags: ["Solar", "Decentralized", "Peak-Shaving"]
    },
    {
      id: "bp-power-vlad",
      category: "Power",
      fromRegionId: "vladivostok",
      country: "Russia",
      title: "District Heating Predictive Thermal Balancing",
      summary: "Automates boiler pressure based on ambient frost forecasts and pipe telemetry to eliminate outages.",
      savingPct: 0.21,
      weeks: 6,
      matchBase: 85,
      tags: ["Thermal", "Cold-Climate", "Automation"]
    },
    {
      id: "bp-power-joburg",
      category: "Power",
      fromRegionId: "joburg",
      country: "South Africa",
      title: "Substation Anti-Surge Battery Buffer Arrays",
      summary: "Installs containerized lithium iron phosphate packs to protect municipal substations from rolling trips.",
      savingPct: 0.19,
      weeks: 16,
      matchBase: 84,
      tags: ["Storage", "Grid-Protection", "Batteries"]
    },
    {
      id: "bp-roads-joburg",
      category: "Roads",
      fromRegionId: "joburg",
      country: "South Africa",
      title: "Community Pothole Rapid-Patch & Polymer Sealant",
      summary: "Empowers local tactical crews with fast-curing asphalt polymer mix for permanent sub-grade repair.",
      savingPct: 0.26,
      weeks: 4,
      matchBase: 89,
      tags: ["Rapid-Repair", "Polymer", "Labor-Inclusive"]
    },
    {
      id: "bp-roads-mum",
      category: "Roads",
      fromRegionId: "mumbai",
      country: "India",
      title: "Monsoon Concrete Interlocking Pavement Overlay",
      summary: "Replaces traditional tar with high-porosity interlocking blocks designed for rapid drainage.",
      savingPct: 0.20,
      weeks: 12,
      matchBase: 87,
      tags: ["Monsoon-Proof", "Permeable", "Heavy-Duty"]
    },
    {
      id: "bp-roads-sh",
      category: "Roads",
      fromRegionId: "shanghai",
      country: "China",
      title: "Sub-Surface Radar Cavity Mapping & Grouting",
      summary: "Scans arterial roads with ground-penetrating radar to detect and inject sinkholes before collapse.",
      savingPct: 0.28,
      weeks: 5,
      matchBase: 94,
      tags: ["Geophysics", "Grouting", "Sinkhole-Prevention"]
    },
    {
      id: "bp-waste-cairo",
      category: "Waste",
      fromRegionId: "cairo",
      country: "Egypt",
      title: "Zabbaleen-Integrated Organic Waste-to-Energy Digesters",
      summary: "Builds neighborhood biomethane capture units co-managed by formal and informal waste collectors.",
      savingPct: 0.23,
      weeks: 18,
      matchBase: 83,
      tags: ["Biogas", "Circular-Economy", "Community"]
    },
    {
      id: "bp-waste-jak",
      category: "Waste",
      fromRegionId: "jakarta",
      country: "Indonesia",
      title: "River Interceptor Trash Booms & Sorting Hubs",
      summary: "Deploys floating barriers and solar automated conveyers at river mouths to intercept solid plastics.",
      savingPct: 0.17,
      weeks: 9,
      matchBase: 86,
      tags: ["Marine-Protection", "Floating-Barrier", "Automated"]
    },
    {
      id: "bp-waste-addis",
      category: "Waste",
      fromRegionId: "addis",
      country: "Ethiopia",
      title: "Composting Micro-Hubs for Municipal Markets",
      summary: "Establishes localized aerobic decomposition pits beside food markets to reduce transit transport loads.",
      savingPct: 0.15,
      weeks: 6,
      matchBase: 78,
      tags: ["Organic", "Decentralized", "Soil-Health"]
    },
    {
      id: "bp-transit-addis",
      category: "Transit",
      fromRegionId: "addis",
      country: "Ethiopia",
      title: "Light-Rail Feeder Bus Interchanges & Dedicated Lanes",
      summary: "Organizes minibuses into structured schedules linking outer residential zones to core rail stations.",
      savingPct: 0.16,
      weeks: 10,
      matchBase: 82,
      tags: ["Feeder-Network", "Bus-Priority", "Modal-Shift"]
    },
    {
      id: "bp-transit-sp",
      category: "Transit",
      fromRegionId: "saopaulo",
      country: "Brazil",
      title: "Bus Rapid Transit Signal Priority Telematics",
      summary: "Transmits real-time bus proximity signals to traffic lights, ensuring green waves along corridors.",
      savingPct: 0.21,
      weeks: 7,
      matchBase: 91,
      tags: ["Telematics", "BRT", "Traffic-Flow"]
    },
    {
      id: "bp-transit-vlad",
      category: "Transit",
      fromRegionId: "vladivostok",
      country: "Russia",
      title: "Funicular & Steep-Grade Electric Minibus Fleets",
      summary: "Deploys high-torque electric all-wheel-drive vans tailored for frozen hillside residential climbs.",
      savingPct: 0.14,
      weeks: 11,
      matchBase: 79,
      tags: ["Topographic", "Electric-Fleet", "Winter-Operations"]
    },
    {
      id: "bp-sanitation-jak",
      category: "Sanitation",
      fromRegionId: "jakarta",
      country: "Indonesia",
      title: "Vacuum-Sealed Faecal Sludge Micro-Treatment Units",
      summary: "Deploys narrow-alley vacuum trucks paired with mobile processing stations to treat unsewered settlements.",
      savingPct: 0.27,
      weeks: 12,
      matchBase: 89,
      tags: ["Dense-Urban", "Mobile-Treatment", "Sludge"]
    },
    {
      id: "bp-sanitation-cairo",
      category: "Sanitation",
      fromRegionId: "cairo",
      country: "Egypt",
      title: "Greywater Separation & Urban Wetland Reed Beds",
      summary: "Diverts sink water into natural filtration gardens to clean local canals and remove raw sewage scents.",
      savingPct: 0.19,
      weeks: 15,
      matchBase: 80,
      tags: ["Nature-Based", "Greywater", "Canal-Restoration"]
    },
    {
      id: "bp-sanitation-mum",
      category: "Sanitation",
      fromRegionId: "mumbai",
      country: "India",
      title: "IoT Smart Public Toilet Block with Automatic Scrubbing",
      summary: "Installs self-cleaning, solar-powered community sanitation blocks with automated water tank monitoring.",
      savingPct: 0.25,
      weeks: 8,
      matchBase: 93,
      tags: ["Smart-Sanitation", "Hygiene", "Self-Cleaning"]
    }
  ];

  const LANGUAGES = [
    {
      code: "hi",
      name: "Hindi",
      sample: "हमारे इलाके में पिछले चार दिनों से गंदा पानी आ रहा है और पाइपलाइन टूटी हुई है।",
      sampleEnglish: "Dirty water has been coming to our area for four days and the pipeline is broken.",
      category: "Water"
    },
    {
      code: "zh",
      name: "Mandarin Chinese",
      sample: "主干道路灯停电已经三天了，晚上老百姓出行非常不安全。",
      sampleEnglish: "The streetlights on the main road have been off for three days, making travel unsafe at night.",
      category: "Power"
    },
    {
      code: "pt",
      name: "Portuguese",
      sample: "Há um buraco enorme na avenida principal causando acidentes e trânsito caótico.",
      sampleEnglish: "There is a massive pothole on the main avenue causing accidents and chaotic traffic.",
      category: "Roads"
    },
    {
      code: "zu",
      name: "Zulu",
      sample: "Inqwaba kadoti ayiqoqiwe amasonto amabili, inyakazisa amagundane nesinye isifo.",
      sampleEnglish: "Uncollected garbage piles have been sitting for two weeks, attracting rodents and disease.",
      category: "Waste"
    },
    {
      code: "ru",
      name: "Russian",
      sample: "Автобусы на линии 14 ходят с задержкой в полтора часа, остановки переполнены.",
      sampleEnglish: "Buses on line 14 are delayed by an hour and a half, bus stops are totally overflowing.",
      category: "Transit"
    },
    {
      code: "ar",
      name: "Arabic",
      sample: "انسداد في شبكة الصرف الصحي يؤدي إلى طفح المياه القذرة في الشارع الرئيسي.",
      sampleEnglish: "Blockage in the sewage network is causing dirty water to overflow onto the main street.",
      category: "Sanitation"
    },
    {
      code: "am",
      name: "Amharic",
      sample: "በአካባቢያችን የመጠጥ ውሃ መስመር ተሰብሮ ውሃው ሙሉ በሙሉ ተቋርጧል።",
      sampleEnglish: "The drinking water pipe in our neighborhood is broken and supply is completely cut off.",
      category: "Water"
    },
    {
      code: "id",
      name: "Indonesian",
      sample: "Pompa penyedot banjir mati saat hujan deras, jalan pemukiman terendam air.",
      sampleEnglish: "The flood pump failed during heavy rain, leaving residential streets submerged in water.",
      category: "Water"
    },
    {
      code: "en",
      name: "English",
      sample: "Transformer explosion caused total blackout in three residential blocks.",
      sampleEnglish: "Transformer explosion caused total blackout in three residential blocks.",
      category: "Power"
    }
  ];

  function createSeededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function seedState() {
    const rng = createSeededRandom(42819);

    const masterDefinitions = [
      // Mumbai
      {
        id: "inc-mum-1",
        regionId: "mumbai",
        title: "Contaminated Tap Water Supply in Dharavi Sector 3",
        neighborhood: "Dharavi Sector 3",
        category: "Water",
        urgency: 9,
        sentiment: "Negative",
        estCost: 18,
        clusterSize: 42,
        slaHours: 24,
        langCode: "hi",
        baseSample: "नल में सीवर का पानी मिल रहा है, पीने का पानी काला और बदबूदार आ रहा है।",
        baseEnglish: "Sewage is mixing with tap water, drinking supply is black and foul-smelling."
      },
      {
        id: "inc-mum-2",
        regionId: "mumbai",
        title: "Flooded Highway Underpass & Damaged Drainage Drain",
        neighborhood: "Kurla West",
        category: "Roads",
        urgency: 7,
        sentiment: "Negative",
        estCost: 14,
        clusterSize: 28,
        slaHours: 48,
        langCode: "hi",
        baseSample: "कुर्ला सबवे में पानी भरा है और बड़ा गड्ढा बन गया है, गाड़ियां फंस रही हैं।",
        baseEnglish: "Kurla subway is flooded with a huge pothole, vehicles are stuck completely."
      },
      // São Paulo
      {
        id: "inc-sp-1",
        regionId: "saopaulo",
        title: "Uncollected Landslide Rubble and Open Sewage Leak",
        neighborhood: "Favela da Paraisópolis",
        category: "Sanitation",
        urgency: 8,
        sentiment: "Negative",
        estCost: 16,
        clusterSize: 35,
        slaHours: 36,
        langCode: "pt",
        baseSample: "Esgoto a céu aberto correndo no morro após o deslizamento, cheiro insuportável.",
        baseEnglish: "Open sewage running down the hill after the landslide, unbearable smell."
      },
      {
        id: "inc-sp-2",
        regionId: "saopaulo",
        title: "Frequent Grid Trips & High-Voltage Cable Sparks",
        neighborhood: "Zona Leste / Itaquera",
        category: "Power",
        urgency: 6,
        sentiment: "Negative",
        estCost: 12,
        clusterSize: 19,
        slaHours: 72,
        langCode: "pt",
        baseSample: "Transformador soltando faíscas todo final de tarde e deixando o bairro no escuro.",
        baseEnglish: "Transformer sparking every late afternoon and leaving the neighborhood in the dark."
      },
      // Vladivostok
      {
        id: "inc-vlad-1",
        regionId: "vladivostok",
        title: "Burst Main Heating Line During Sub-Zero Snap",
        neighborhood: "Egersheld Peninsula",
        category: "Power",
        urgency: 10,
        sentiment: "Negative",
        estCost: 22,
        clusterSize: 54,
        slaHours: 12,
        langCode: "ru",
        baseSample: "Прорыв теплотрассы в минус 15, батареи ледяные уже шесть часов во всем районе.",
        baseEnglish: "Heating main burst at -15C, radiators freezing cold for six hours across the district."
      },
      {
        id: "inc-vlad-2",
        regionId: "vladivostok",
        title: "Icy Slope Bus Slip Hazard & Road Cave-In",
        neighborhood: "Pervorechensky District",
        category: "Roads",
        urgency: 5,
        sentiment: "Negative",
        estCost: 9,
        clusterSize: 14,
        slaHours: 96,
        langCode: "ru",
        baseSample: "Дорога покрыта льдом, глубокая трещина на подъеме, автобусы не могут подняться.",
        baseEnglish: "Road covered in ice with a deep crack on the slope, buses cannot climb up."
      },
      // Shanghai
      {
        id: "inc-sh-1",
        regionId: "shanghai",
        title: "Subsurface Pipe Subsidence Near Metro Exit",
        neighborhood: "Yangpu District / Wujiaochang",
        category: "Roads",
        urgency: 8,
        sentiment: "Negative",
        estCost: 26,
        clusterSize: 38,
        slaHours: 24,
        langCode: "zh",
        baseSample: "地铁口附近的地面出现明显沉降和开裂，管道可能有渗漏风险。",
        baseEnglish: "Noticeable ground subsidence and cracking near the metro exit, risk of pipe leakage."
      },
      {
        id: "inc-sh-2",
        regionId: "shanghai",
        title: "Overloaded Smart Waste Compactor Network",
        neighborhood: "Pudong New Area / Lujiazui Outer",
        category: "Waste",
        urgency: 4,
        sentiment: "Neutral",
        estCost: 8,
        clusterSize: 11,
        slaHours: 120,
        langCode: "zh",
        baseSample: "智能垃圾桶满溢报警失灵，堆放垃圾影响沿街商业区卫生。",
        baseEnglish: "Smart bin overflow alarms failing, piled trash affecting street commercial hygiene."
      },
      // Johannesburg
      {
        id: "inc-joburg-1",
        regionId: "joburg",
        title: "Critical Water Tower Pump Failure & Low Pressure",
        neighborhood: "Soweto / Orlando West",
        category: "Water",
        urgency: 9,
        sentiment: "Negative",
        estCost: 20,
        clusterSize: 49,
        slaHours: 24,
        langCode: "zu",
        baseSample: "Amapompi amanzi awasebenzi, impahla nezikole azinawo amanzi kusukela izolo.",
        baseEnglish: "Water pumps failed, homes and schools have had no water since yesterday."
      },
      {
        id: "inc-joburg-2",
        regionId: "joburg",
        title: "Stolen Substation Copper & Cable Feeder Outage",
        neighborhood: "Alexandria Township",
        category: "Power",
        urgency: 8,
        sentiment: "Negative",
        estCost: 15,
        clusterSize: 31,
        slaHours: 36,
        langCode: "en",
        baseSample: "Substation cables stolen overnight, entire sector running on dying backup generators.",
        baseEnglish: "Substation cables stolen overnight, entire sector running on dying backup generators."
      },
      // Cairo
      {
        id: "inc-cairo-1",
        regionId: "cairo",
        title: "Main Canal Waste Clogging & Toxic Odor",
        neighborhood: "Manshiyat Naser",
        category: "Waste",
        urgency: 7,
        sentiment: "Negative",
        estCost: 13,
        clusterSize: 26,
        slaHours: 48,
        langCode: "ar",
        baseSample: "تراكم القمامة في القناة يسبب انسداد كلي ورائحة كريهة تحرم السكان من فتح النوافذ.",
        baseEnglish: "Trash accumulation in the canal causes total blockage and a awful stench."
      },
      {
        id: "inc-cairo-2",
        regionId: "cairo",
        title: "Broken Main Sewer Pipe Discharging to Market Street",
        neighborhood: "Imbaba District",
        category: "Sanitation",
        urgency: 9,
        sentiment: "Negative",
        estCost: 19,
        clusterSize: 45,
        slaHours: 18,
        langCode: "ar",
        baseSample: "ماسورة الصرف الصحي الرئيسية انفجرت والمياه الملوثة تغمر السوق الشعبية.",
        baseEnglish: "Main sewage pipe burst and contaminated water is flooding the public market."
      },
      // Addis Ababa
      {
        id: "inc-addis-1",
        regionId: "addis",
        title: "Commuter Mini-Bus Terminal Gridlock & Transit Shortage",
        neighborhood: "Mercato Terminal Zone",
        category: "Transit",
        urgency: 6,
        sentiment: "Negative",
        estCost: 11,
        clusterSize: 22,
        slaHours: 72,
        langCode: "am",
        baseSample: "በመርካቶ አውቶቡስ ተርሚናል በቂ ትራንስፖርት ባለመኖሩ ህዝቡ በከፍተኛ እንግልት ላይ ይገኛል።",
        baseEnglish: "Lack of transportation at Mercato bus terminal causing severe commuter distress."
      },
      {
        id: "inc-addis-2",
        regionId: "addis",
        title: "Major Feeder Road Washout After Heavy Torrent",
        neighborhood: "Bole Sub-City / Ring Road Connector",
        category: "Roads",
        urgency: 7,
        sentiment: "Negative",
        estCost: 17,
        clusterSize: 33,
        slaHours: 48,
        langCode: "am",
        baseSample: "በከባድ ዝናብ ምክንያት መንገዱ ተሸርሽሮ ትላልቅ ጉድጓዶች በመፈጠራቸው ትራፊክ ተዝግቷል።",
        baseEnglish: "Heavy rainfall washed out the road creating huge pits, closing down traffic."
      },
      // Jakarta
      {
        id: "inc-jak-1",
        regionId: "jakarta",
        title: "Seawall Sump Pump Electrical Shortage & Overflow",
        neighborhood: "Penjaringan / North Jakarta",
        category: "Water",
        urgency: 10,
        sentiment: "Negative",
        estCost: 31,
        clusterSize: 60,
        slaHours: 12,
        langCode: "id",
        baseSample: "Pompa utama tanggul laut mati listrik, air laut pasang mulai masuk ke pemukiman warga.",
        baseEnglish: "Main seawall pump lost power, high tide water starting to flood residential homes."
      },
      {
        id: "inc-jak-2",
        regionId: "jakarta",
        title: "Unlicensed Dump Site Leachate Contaminating Well",
        neighborhood: "Kampung Melayu",
        category: "Sanitation",
        urgency: 8,
        sentiment: "Negative",
        estCost: 15,
        clusterSize: 29,
        slaHours: 36,
        langCode: "id",
        baseSample: "Limbah sampah liar merembes ke sumur warga, air berbau busuk dan bikin gatal.",
        baseEnglish: "Illegal dump leachate seeping into citizen wells, water smells terrible and causes itching."
      }
    ];

    const firstNames = [
      "Aarav", "Priya", "Rahul", "Ananya", "Carlos", "Fernanda", "Dmitry", "Elena",
      "Wei", "Xiaoyan", "Siyabonga", "Nomvula", "Tariq", "Fatima", "Abebe", "Beti",
      "Budi", "Siti", "John", "Sarah"
    ];

    const lastNames = [
      "Sharma", "Patel", "Silva", "Santos", "Ivanov", "Petrova", "Zhang", "Chen",
      "Dlamini", "Nkosi", "Hassan", "Ali", "Tadesse", "Bekele", "Wijaya", "Sutrisno",
      "Smith", "Jones"
    ];

    function makePhone(cc, idx) {
      const p1 = Math.floor(100 + rng() * 899);
      const p2 = Math.floor(1000 + rng() * 8999);
      if (cc === "IN") return `+91 98${Math.floor(10 + rng() * 89)}-${p1}${p2.toString().substring(0, 3)}`;
      if (cc === "BR") return `+55 11 9${p1}-${p2}`;
      if (cc === "RU") return `+7 9${Math.floor(10 + rng() * 89)} ${p1}-${p2.toString().substring(0, 4)}`;
      if (cc === "CN") return `+86 138 ${p1} ${p2}`;
      if (cc === "ZA") return `+27 82 ${p1} ${p2.toString().substring(0, 4)}`;
      if (cc === "EG") return `+20 10 ${p1} ${p2.toString().substring(0, 4)}`;
      if (cc === "ET") return `+251 91 ${p1} ${p2.toString().substring(0, 4)}`;
      if (cc === "ID") return `+62 812 ${p1} ${p2}`;
      return `+1 555 ${p1} ${p2}`;
    }

    const incidents = masterDefinitions.map(def => {
      const reg = REGIONS.find(r => r.id === def.regionId);
      const reportCount = Math.min(8, Math.max(3, Math.floor(def.clusterSize / 6)));
      const reports = [];

      for (let i = 0; i < reportCount; i++) {
        const fname = firstNames[Math.floor(rng() * firstNames.length)];
        const lname = lastNames[Math.floor(rng() * lastNames.length)];
        const tsDate = new Date(Date.now() - Math.floor(rng() * 172800000));

        reports.push({
          id: `rep-${def.id}-${i + 1}`,
          name: `${fname} ${lname}`,
          phone: makePhone(reg.cc, i),
          lang: def.langCode,
          originalText: i === 0 ? def.baseSample : `${def.baseSample} (#${i + 1} follow-up)`,
          englishText: i === 0 ? def.baseEnglish : `${def.baseEnglish} (micro-report ${i + 1})`,
          sentiment: def.sentiment,
          urgency: Math.min(10, Math.max(1, def.urgency + (i % 2 === 0 ? 0 : -1))),
          ts: tsDate.toISOString()
        });
      }

      return {
        id: def.id,
        regionId: def.regionId,
        title: def.title,
        neighborhood: def.neighborhood,
        category: def.category,
        urgency: def.urgency,
        sentiment: def.sentiment,
        estCost: def.estCost,
        clusterSize: def.clusterSize,
        createdAt: new Date(Date.now() - Math.floor(rng() * 864000000)).toISOString(),
        slaHours: def.slaHours,
        reports: reports
      };
    });

    return {
      budget: 90,
      anonymize: true,
      selectedIssueId: null,
      activeTab: "command",
      incidents: incidents,
      plan: {},
      audit: []
    };
  }

  CL.data = {
    REGIONS: REGIONS,
    CATEGORIES: CATEGORIES,
    BLUEPRINTS: BLUEPRINTS,
    LANGUAGES: LANGUAGES,
    seedState: seedState
  };
})();
