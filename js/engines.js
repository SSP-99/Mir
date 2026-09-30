// js/engines.js
(function() {
  const CL = window.CL = window.CL || {};

  // Glossaries for machine-gist translation fallback
  const GLOSSARY = {
    hi: { water: 'पानी', pipe: 'पाइप', road: 'सड़क', light: 'लाइट', power: 'बिजली', garbage: 'कचरा', bus: 'बस', sewage: 'सीवर' },
    zh: { water: '水', pipe: '管道', road: '道路', light: '灯', power: '电力', garbage: '垃圾', bus: '公交车', sewage: '污水' },
    pt: { water: 'água', pipe: 'cano', road: 'estrada', light: 'luz', power: 'energia', garbage: 'lixo', bus: 'ônibus', sewage: 'esgoto' },
    zu: { water: 'amanzi', pipe: 'impayipi', road: 'umgwaqo', light: 'ukukhanya', power: 'amandamandla', garbage: 'udoti', bus: 'ibhasi', sewage: 'indle' },
    ru: { water: 'вода', pipe: 'truba', road: 'дорога', light: 'свет', power: 'электричество', garbage: 'мусор', bus: 'автобус', sewage: 'канализация' },
    ar: { water: 'ماء', pipe: 'أنبوب', road: 'طريق', light: 'ضوء', power: 'كهرباء', garbage: 'قمامة', bus: 'حافلة', sewage: 'مجاري' },
    am: { water: 'ውሃ', pipe: 'ቧንቧ', road: 'መንገድ', light: 'መብራት', power: 'ኃይል', garbage: 'ቆሻሻ', bus: 'አውቶቡስ', sewage: 'ፍሳሽ' },
    id: { water: 'air', pipe: 'pipa', road: 'jalan', light: 'lampu', power: 'listrik', garbage: 'sampah', bus: 'bus', sewage: 'limbah' }
  };

  const KEYWORD_MAP = {
    Water: ['water', 'pipe', 'burst', 'leak', 'flooding', 'supply', 'tap', 'drain', 'पानी', 'पाइप', '水', 'água', 'amanzi', 'вода', 'ماء', 'ውሃ', 'air'],
    Power: ['power', 'electricity', 'blackout', 'outage', 'wire', 'grid', 'transformer', 'light', 'बिजली', 'लाइट', '电力', 'energia', 'luz', 'свет', 'كهرباء', 'መብራት', 'listrik'],
    Roads: ['road', 'pothole', 'traffic', 'bridge', 'asphalt', 'pavement', 'street', 'सड़क', '道路', 'estrada', 'umgwaqo', 'дорога', 'طريق', 'መንገድ', 'jalan'],
    Waste: ['waste', 'garbage', 'trash', 'dumping', 'rubbish', 'overflowing', 'bin', 'कचरा', '垃圾', 'lixo', 'udoti', 'мусор', 'قمامة', 'ቆሻሻ', 'sampah'],
    Transit: ['transit', 'bus', 'train', 'metro', 'stop', 'route', 'delay', 'बस', '公交车', 'ônibus', 'ibhasi', 'автобус', 'حافلة', 'አውቶቡስ'],
    Sanitation: ['sanitation', 'sewage', 'drainage', 'feces', 'odor', 'smell', 'sewer', 'सीवर', '污水', 'esgoto', 'indle', 'канализация', 'مجاري', 'ፍሳሽ', 'limbah']
  };

  const URGENCY_KEYWORDS = [
    { word: 'burst', weight: 3 },
    { word: 'danger', weight: 4 },
    { word: 'dangerous', weight: 4 },
    { word: 'children', weight: 2 },
    { word: 'hospital', weight: 3 },
    { word: 'fire', weight: 5 },
    { word: 'flood', weight: 4 },
    { word: 'days without', weight: 3 },
    { word: 'cold', weight: 2 },
    { word: 'hazard', weight: 3 },
    { word: 'emergency', weight: 4 },
    { word: 'collapse', weight: 4 }
  ];

  const POSITIVE_WORDS = ['fixed', 'good', 'thank', 'thanks', 'repaired', 'resolved', 'great', 'safe', 'prompt'];
  const NEGATIVE_WORDS = ['broken', 'fail', 'failure', 'worst', 'bad', 'dirty', 'unacceptable', 'danger', 'hazard', 'terrible', 'stink', 'blocked', 'overflow', 'outage', 'burst'];

  const NAMES_SEED = ['Rajesh', 'Priya', 'Aarav', 'Silva', 'Santos', 'Zhang', 'Wei', 'Ivan', 'Olga', 'Ndlovu', 'Sipho', 'Ahmed', 'Fatima', 'Budi', 'Abebe'];

  // Helper for SHA-256 / Fallback Simple Hash
  async function computeHash(message) {
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      try {
        const msgUint8 = new TextEncoder().encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // Fallback below
      }
    }
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }

  CL.engines = {
    priorityScore: function(incident, region) {
      if (!incident || !region || !region.idi) return 0;
      return (incident.urgency * region.density) / region.idi;
    },

    regionScore: function(regionId) {
      const store = CL.store ? CL.store.get() : {};
      const incidents = (store.incidents || []).filter(i => i.regionId === regionId);
      if (!incidents.length) return 0;
      const regions = (CL.data && CL.data.REGIONS) ? CL.data.REGIONS : [];
      const region = regions.find(r => r.id === regionId) || { density: 10, idi: 50 };
      
      let maxScore = 0;
      incidents.forEach(inc => {
        const score = CL.engines.priorityScore(inc, region);
        if (score > maxScore) maxScore = score;
      });
      return maxScore;
    },

    effectiveCost: function(incident) {
      if (!incident) return 0;
      const store = CL.store ? CL.store.get() : {};
      const plan = store.plan || {};
      const deployedBlueprintId = plan[incident.id];
      
      let savingPct = 0;
      if (deployedBlueprintId && CL.data && CL.data.BLUEPRINTS) {
        const bp = CL.data.BLUEPRINTS.find(b => b.id === deployedBlueprintId);
        if (bp) savingPct = bp.savingPct || 0;
      }
      return (incident.estCost || 0) * (1 - savingPct);
    },

    allocateBudget: function(customBudget) {
      const store = CL.store ? CL.store.get() : {};
      const budget = customBudget !== undefined ? customBudget : (store.budget !== undefined ? store.budget : 90);
      const incidents = (store.incidents || []).slice();
      const regions = (CL.data && CL.data.REGIONS) ? CL.data.REGIONS : [];

      const scored = incidents.map(inc => {
        const region = regions.find(r => r.id === inc.regionId) || { density: 10, idi: 50 };
        return {
          incident: inc,
          priority: CL.engines.priorityScore(inc, region),
          cost: CL.engines.effectiveCost(inc)
        };
      });

      scored.sort((a, b) => b.priority - a.priority);

      let remaining = budget;
      let used = 0;
      const byId = {};

      scored.forEach(item => {
        const id = item.incident.id;
        const cost = item.cost;

        if (cost <= 0) {
          byId[id] = { status: 'funded', pct: 1, funded: 0, cost: 0 };
        } else if (remaining >= cost) {
          remaining -= cost;
          used += cost;
          byId[id] = { status: 'funded', pct: 1, funded: cost, cost: cost };
        } else if (remaining > 0) {
          const funded = remaining;
          const pct = funded / cost;
          used += funded;
          remaining = 0;
          byId[id] = { status: 'partial', pct: pct, funded: funded, cost: cost };
        } else {
          byId[id] = { status: 'deferred', pct: 0, funded: 0, cost: cost };
        }
      });

      return { byId: byId, used: used, remaining: remaining };
    },

    metrics: function() {
      const store = CL.store ? CL.store.get() : {};
      const incidents = store.incidents || [];
      const allocation = CL.engines.allocateBudget();

      let totalReports = 0;
      let activeHotspots = 0;
      let citizensImpacted = 0;

      incidents.forEach(inc => {
        const size = inc.clusterSize || 1;
        totalReports += size;

        if ((inc.urgency || 0) >= 7) {
          activeHotspots++;
        }

        const alloc = allocation.byId[inc.id] || { pct: 0 };
        citizensImpacted += Math.round(size * 1200 * alloc.pct);
      });

      const masterCount = incidents.length;
      const budgetUtilization = store.budget > 0 ? Math.min(100, (allocation.used / store.budget) * 100) : 0;
      const aiEfficiency = totalReports > 0 ? (1 - (masterCount / totalReports)) * 100 : 0;

      return {
        citizensImpacted: citizensImpacted,
        activeHotspots: activeHotspots,
        budgetUtilization: budgetUtilization,
        aiEfficiency: aiEfficiency,
        totalReports: totalReports,
        masterCount: masterCount
      };
    },

    similarity: function(textA, textB) {
      if (!textA || !textB) return 0;
      const tokenize = str => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
      const tokensA = new Set(tokenize(String(textA)));
      const tokensB = new Set(tokenize(String(textB)));

      if (tokensA.size === 0 || tokensB.size === 0) return 0;

      let intersection = 0;
      tokensA.forEach(t => {
        if (tokensB.has(t)) intersection++;
      });

      const union = new Set([...tokensA, ...tokensB]).size;
      return union === 0 ? 0 : intersection / union;
    },

    analyzeReport: async function(opts) {
      opts = opts || {};
      const rawText = opts.text || '';
      const langHint = opts.langHint || 'en';

      const delay = ms => new Promise(r => setTimeout(r, ms));
      const steps = [
        "Detecting language",
        "Translating to English",
        "Analysing sentiment",
        "Scoring urgency"
      ];

      // Step 1: Detect Language
      await delay(450);
      let detectedLang = 'en';
      if (/[\u0900-\u097F]/.test(rawText)) detectedLang = 'hi';
      else if (/[\u4E00-\u9FFF]/.test(rawText)) detectedLang = 'zh';
      else if (/[\u0400-\u04FF]/.test(rawText)) detectedLang = 'ru';
      else if (/[\u0600-\u06FF]/.test(rawText)) detectedLang = 'ar';
      else if (/[\u1200-\u137F]/.test(rawText)) detectedLang = 'am';
      else if (/\b(água|cano|estrada|lixo|ônibus)\b/i.test(rawText)) detectedLang = 'pt';
      else if (/\b(amanzi|umgwaqo|udoti|ibhasi)\b/i.test(rawText)) detectedLang = 'zu';
      else if (/\b(air|pipa|jalan|sampah|limbah)\b/i.test(rawText)) detectedLang = 'id';
      else if (langHint && langHint !== 'en') detectedLang = langHint;

      const langs = (CL.data && CL.data.LANGUAGES) ? CL.data.LANGUAGES : [];
      const langObj = langs.find(l => l.code === detectedLang) || { name: 'English' };
      const langName = langObj.name || 'English';
      const confidence = detectedLang === 'en' ? 0.99 : 0.92;

      // Step 2: Translate
      await delay(450);
      let english = rawText;
      if (detectedLang !== 'en') {
        const matchedSample = langs.find(l => l.code === detectedLang && l.sample === rawText);
        if (matchedSample && matchedSample.sampleEnglish) {
          english = matchedSample.sampleEnglish;
        } else {
          const dict = GLOSSARY[detectedLang] || {};
          let foundWords = [];
          Object.keys(dict).forEach(engKey => {
            if (rawText.includes(dict[engKey])) foundWords.push(engKey);
          });

          if (foundWords.length > 0) {
            english = `Citizen report regarding ${foundWords.join(', ')} issue: "${rawText}"`;
          } else {
            english = `Citizen report (machine gist): ${rawText}`;
          }
        }
      }

      // Step 3: Sentiment
      await delay(450);
      const lower = english.toLowerCase();
      let posCount = 0, negCount = 0;
      POSITIVE_WORDS.forEach(w => { if (lower.includes(w)) posCount++; });
      NEGATIVE_WORDS.forEach(w => { if (lower.includes(w)) negCount++; });

      let sentiment = 'Neutral';
      if (negCount > posCount) sentiment = 'Negative';
      else if (posCount > negCount) sentiment = 'Positive';

      // Step 4: Urgency & Category
      await delay(450);
      let urgency = 3;
      URGENCY_KEYWORDS.forEach(item => {
        if (lower.includes(item.word)) urgency += item.weight;
      });

      if (rawText === rawText.toUpperCase() && rawText.length > 10) urgency += 2;
      if ((rawText.match(/!/g) || []).length >= 2) urgency += 1;

      // Category detection
      let category = 'Water';
      let maxCatHits = 0;
      Object.keys(KEYWORD_MAP).forEach(cat => {
        let hits = 0;
        KEYWORD_MAP[cat].forEach(kw => {
          if (rawText.toLowerCase().includes(kw) || lower.includes(kw)) hits++;
        });
        if (hits > maxCatHits) {
          maxCatHits = hits;
          category = cat;
        }
      });

      if (category === 'Power' || category === 'Water') urgency += 1;
      urgency = Math.min(10, Math.max(1, urgency));

      return {
        detectedLang: detectedLang,
        langName: langName,
        confidence: confidence,
        english: english,
        sentiment: sentiment,
        urgency: urgency,
        category: category,
        steps: steps
      };
    },

    ingestReport: function(opts) {
      opts = opts || {};
      const store = CL.store ? CL.store.get() : {};
      const incidents = (store.incidents || []).slice();
      const analysis = opts.analysis || {};
      const rawText = opts.text || '';
      const englishText = analysis.english || rawText;

      const newReport = {
        id: CL.util ? CL.util.uid('rep') : 'rep_' + Date.now(),
        name: opts.name || 'Anonymous',
        phone: opts.phone || '',
        lang: opts.lang || analysis.detectedLang || 'en',
        originalText: rawText,
        englishText: englishText,
        sentiment: analysis.sentiment || 'Neutral',
        urgency: analysis.urgency || 5,
        ts: new Date().toISOString()
      };

      let targetIncident = null;
      for (let inc of incidents) {
        if (inc.regionId === opts.regionId && inc.category === (analysis.category || 'Water')) {
          const sim = CL.engines.similarity(inc.title + ' ' + inc.reports.map(r => r.englishText).join(' '), englishText);
          if (sim >= 0.15 || (opts.neighborhood && inc.neighborhood === opts.neighborhood)) {
            targetIncident = inc;
            break;
          }
        }
      }

      let resultIncidentId = null;
      let isMerged = false;

      if (targetIncident) {
        isMerged = true;
        resultIncidentId = targetIncident.id;
        targetIncident.clusterSize = (targetIncident.clusterSize || 1) + 1;
        targetIncident.urgency = Math.max(targetIncident.urgency || 1, newReport.urgency);
        targetIncident.reports = targetIncident.reports || [];
        targetIncident.reports.unshift(newReport);
        if (targetIncident.reports.length > 8) {
          targetIncident.reports = targetIncident.reports.slice(0, 8);
        }
      } else {
        isMerged = false;
        const cat = analysis.category || 'Water';
        const costMap = { Water: 12, Power: 18, Roads: 15, Waste: 8, Transit: 25, Sanitation: 10 };
        const urg = analysis.urgency || 5;

        const newInc = {
          id: CL.util ? CL.util.uid('inc') : 'inc_' + Date.now(),
          regionId: opts.regionId || 'mumbai',
          title: `${cat} Disruption (${opts.neighborhood || 'Central Zone'})`,
          neighborhood: opts.neighborhood || 'Central Zone',
          category: cat,
          urgency: urg,
          sentiment: newReport.sentiment,
          estCost: costMap[cat] || 12,
          clusterSize: 1,
          createdAt: new Date().toISOString(),
          slaHours: Math.max(12, 72 - (urg * 5)),
          reports: [newReport]
        };

        resultIncidentId = newInc.id;
        incidents.unshift(newInc);
      }

      if (CL.store) {
        CL.store.update(state => {
          state.incidents = incidents;
        });
      }

      CL.engines.appendAudit('ingest', `Report ingested for ${opts.regionId || 'region'}. Merged: ${isMerged}`);

      return { incidentId: resultIncidentId, merged: isMerged };
    },

    anonymizeText: function(str) {
      if (!str) return '';
      let out = String(str);

      // Emails
      out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]');
      // Phone numbers
      out = out.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE REDACTED]');
      // 6+ digit IDs
      out = out.replace(/\b\d{6,}\b/g, '[ID REDACTED]');
      // Names following triggers
      out = out.replace(/(?:I am|my name is|name:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, '$1: [NAME REDACTED]');

      // Known seed names
      NAMES_SEED.forEach(name => {
        const reg = new RegExp(`\\b${name}\\b`, 'gi');
        out = out.replace(reg, '[NAME REDACTED]');
      });

      return out;
    },

    maskReport: function(report, on) {
      if (!report) return {};
      const copy = JSON.parse(JSON.stringify(report));
      if (on === true) {
        if (copy.name) copy.name = CL.engines.anonymizeText(copy.name);
        if (copy.phone) copy.phone = '[PHONE REDACTED]';
        if (copy.originalText) copy.originalText = CL.engines.anonymizeText(copy.originalText);
        if (copy.englishText) copy.englishText = CL.engines.anonymizeText(copy.englishText);
      }
      return copy;
    },

    matchBlueprint: function(incident) {
      if (!incident) return { blueprint: null, matchPct: 0, reasons: [], alternatives: [] };
      const blueprints = (CL.data && CL.data.BLUEPRINTS) ? CL.data.BLUEPRINTS : [];

      const filtered = blueprints.filter(b => b.category === incident.category);
      if (!filtered.length) {
        return { blueprint: null, matchPct: 0, reasons: ["No category match found"], alternatives: [] };
      }

      const scored = filtered.map(bp => {
        let pct = bp.matchBase || 75;
        const reasons = [];

        if (bp.fromRegionId !== incident.regionId) {
          pct += 10;
          reasons.push(`Cross-border transfer from ${bp.country}`);
        } else {
          reasons.push(`Domestic blueprint deployment`);
        }

        if (incident.urgency >= 8 && bp.weeks <= 6) {
          pct += 5;
          reasons.push('Fast-track execution matches high urgency');
        }

        pct = Math.min(99, pct);
        return { blueprint: bp, matchPct: pct, reasons: reasons };
      });

      scored.sort((a, b) => b.matchPct - a.matchPct);
      const best = scored[0];
      const alternatives = scored.slice(1).map(s => s.blueprint);

      return {
        blueprint: best.blueprint,
        matchPct: best.matchPct,
        reasons: best.reasons,
        alternatives: alternatives
      };
    },

    deployBlueprint: function(incidentId, blueprintId) {
      if (!incidentId || !blueprintId) return;
      if (CL.store) {
        CL.store.update(state => {
          state.plan = state.plan || {};
          state.plan[incidentId] = blueprintId;
        });
      }
      CL.engines.appendAudit('deploy', `Deployed blueprint ${blueprintId} to incident ${incidentId}`);
    },

    generateBrief: function(opts) {
      opts = opts || {};
      const store = CL.store ? CL.store.get() : {};
      const incidents = store.incidents || [];
      const regions = (CL.data && CL.data.REGIONS) ? CL.data.REGIONS : [];
      const blueprints = (CL.data && CL.data.BLUEPRINTS) ? CL.data.BLUEPRINTS : [];
      const metrics = CL.engines.metrics();
      const allocation = CL.engines.allocateBudget();

      let md = `# CivicLens BRICS Executive Intelligence Briefing\n`;
      md += `**Generated:** ${new Date().toUTCString()}\n`;
      md += `**Anonymization Mode:** ${opts.anonymize ? 'ENABLED (PII Redacted)' : 'DISABLED'}\n\n`;

      md += `## 1. Executive Summary & Metrics\n`;
      md += `- **Citizens Impacted:** ${metrics.citizensImpacted.toLocaleString()}\n`;
      md += `- **Active Hotspots (Urgency >= 7):** ${metrics.activeHotspots}\n`;
      md += `- **Budget Utilization:** ${metrics.budgetUtilization.toFixed(1)}%\n`;
      md += `- **AI Merging Efficiency:** ${metrics.aiEfficiency.toFixed(1)}%\n`;
      md += `- **Total Raw Micro-Reports:** ${metrics.totalReports}\n`;
      md += `- **Master Incidents:** ${metrics.masterCount}\n\n`;

      md += `## 2. Resource Allocation Matrix\n`;
      md += `| Incident Title | Region | Urgency | Priority Score | Est. Cost | Funded | Status |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const sorted = incidents.slice().sort((a, b) => {
        const regA = regions.find(r => r.id === a.regionId) || { density: 10, idi: 50 };
        const regB = regions.find(r => r.id === b.regionId) || { density: 10, idi: 50 };
        return CL.engines.priorityScore(b, regB) - CL.engines.priorityScore(a, regA);
      });

      sorted.forEach(inc => {
        const reg = regions.find(r => r.id === inc.regionId) || { name: inc.regionId, density: 10, idi: 50 };
        const pScore = CL.engines.priorityScore(inc, reg).toFixed(1);
        const alloc = allocation.byId[inc.id] || { funded: 0, status: 'deferred' };
        const title = opts.anonymize ? CL.engines.anonymizeText(inc.title) : inc.title;

        md += `| ${title} | ${reg.name} | ${inc.urgency} | ${pScore} | $${inc.estCost}M | $${alloc.funded.toFixed(1)}M | ${alloc.status.toUpperCase()} |\n`;
      });
      md += `\n`;

      md += `## 3. Regional Profile Overview\n`;
      regions.forEach(reg => {
        const score = CL.engines.regionScore(reg.id).toFixed(1);
        md += `- **${reg.name} (${reg.country})**: IDI Index = ${reg.idi}, Density = ${reg.density}k/km², Peak Priority Score = ${score}\n`;
      });
      md += `\n`;

      md += `## 4. Deployed Infrastructure Blueprints\n`;
      const plan = store.plan || {};
      const planKeys = Object.keys(plan);
      if (planKeys.length === 0) {
        md += `*No global blueprints currently deployed.*\n\n`;
      } else {
        planKeys.forEach(incId => {
          const bpId = plan[incId];
          const bp = blueprints.find(b => b.id === bpId);
          const inc = incidents.find(i => i.id === incId);
          if (bp && inc) {
            md += `- **Incident:** ${inc.title} -> **Blueprint:** ${bp.title} (${bp.country}, -${(bp.savingPct * 100).toFixed(0)}% cost, ${bp.weeks} wks)\n`;
          }
        });
        md += `\n`;
      }

      md += `## 5. Methodology & Governance Notice\n`;
      md += `Priority Scores are dynamically computed via \`(Urgency * Density) / IDI\`. All allocation decisions follow strict cryptographic audit logging. PII filtering uses heuristic regex token replacement.\n`;

      return md;
    },

    appendAudit: async function(type, msg) {
      const store = CL.store ? CL.store.get() : {};
      const audit = store.audit || [];
      const prevHash = audit.length > 0 ? audit[audit.length - 1].hash : 'GENESIS_HASH_00000000000000000000000000000000';
      
      const id = CL.util ? CL.util.uid('aud') : 'aud_' + Date.now();
      const ts = new Date().toISOString();
      const payload = `${id}|${ts}|${type}|${msg}|${prevHash}`;
      const hash = await computeHash(payload);

      const entry = {
        id: id,
        ts: ts,
        type: type,
        msg: msg,
        hash: hash,
        prevHash: prevHash
      };

      if (CL.store) {
        CL.store.update(state => {
          state.audit = state.audit || [];
          state.audit.push(entry);
        });
      }
    },

    verifyAudit: async function() {
      const store = CL.store ? CL.store.get() : {};
      const audit = store.audit || [];

      for (let i = 0; i < audit.length; i++) {
        const item = audit[i];
        const expectedPrevHash = i === 0 ? 'GENESIS_HASH_00000000000000000000000000000000' : audit[i - 1].hash;

        if (item.prevHash !== expectedPrevHash) {
          return { ok: false, brokenAt: i };
        }

        const payload = `${item.id}|${item.ts}|${item.type}|${item.msg}|${item.prevHash}`;
        const calculatedHash = await computeHash(payload);

        if (calculatedHash !== item.hash) {
          return { ok: false, brokenAt: i };
        }
      }

      return { ok: true, brokenAt: null };
    }
  };
})();
