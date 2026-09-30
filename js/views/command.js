// js/views/command.js
(function(){
  const CL = window.CL = window.CL || {};

  function safe(fn, fallback){ try { return fn(); } catch(e){ return fallback; } }

  function mount(container){
    const U = CL.util || {};
    const esc = U.esc || function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
    const fmt = U.fmt || function(n){ return Math.round(n).toLocaleString('en-US'); };
    const f1 = U.f1 || function(n){ return (Math.round(n*10)/10).toFixed(1); };
    const icons = function(){ if (U.icons) U.icons(); else if (window.lucide && lucide.createIcons) lucide.createIcons(); };

    const CATCOL = { Water:'#38bdf8', Power:'#e3b23c', Roads:'#a78bfa', Waste:'#34d399', Transit:'#fb7185', Sanitation:'#f97316' };
    const STATUS = {
      funded:{ label:'Funded', color:'var(--ok)' },
      partial:{ label:'Partially Funded', color:'var(--warn)' },
      deferred:{ label:'Deferred', color:'var(--bad)' }
    };

    let viewMode = 'grid';
    let mapCleanup = null;
    const lastMetrics = {};
    const anim = {};
    const rafs = {};

    container.innerHTML =
      '<div class="cc-root" style="display:flex;flex-direction:column;gap:16px;">' +
        '<style>' +
        '.cc-panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;}' +
        '.cc-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}' +
        '.cc-title{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;display:flex;align-items:center;gap:8px;}' +
        '.cc-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}' +
        '.cc-metric-val{font-size:28px;font-weight:700;color:var(--text);}' +
        '.cc-metric-lbl{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;}' +
        '.cc-bar{height:8px;background:var(--line);border-radius:999px;overflow:hidden;}' +
        '.cc-bar>div{height:100%;border-radius:999px;transition:width .6s ease, background .3s;}' +
        '.cc-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;}' +
        '.cc-tile{border:1px solid var(--line);border-radius:10px;padding:12px;position:relative;overflow:hidden;transition:background .4s,border-color .4s;}' +
        '.cc-tile .k{font-size:11px;color:var(--muted);}' +
        '.cc-tile .v{font-size:12px;color:var(--text);}' +
        '@keyframes ccPulse{0%{box-shadow:0 0 0 0 rgba(251,113,133,.6);}70%{box-shadow:0 0 0 10px rgba(251,113,133,0);}100%{box-shadow:0 0 0 0 rgba(251,113,133,0);}}' +
        '.cc-pulse{animation:ccPulse 1.8s infinite;}' +
        '.cc-row{display:grid;grid-template-columns:28px 1fr 130px;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:10px;cursor:pointer;transition:border-color .2s,background .2s;}' +
        '.cc-row:hover{border-color:var(--gold);background:rgba(227,178,60,.05);}' +
        '.cc-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid;white-space:nowrap;display:inline-block;}' +
        '.cc-toggle button{padding:4px 12px;font-size:12px;border:1px solid var(--line);color:var(--muted);background:transparent;}' +
        '.cc-toggle button:first-child{border-radius:8px 0 0 8px;}' +
        '.cc-toggle button:last-child{border-radius:0 8px 8px 0;border-left:0;}' +
        '.cc-toggle button.on{background:var(--gold);color:#0a1018;border-color:var(--gold);font-weight:600;}' +
        '.cc-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;}' +
        '@media (max-width:900px){.cc-two{grid-template-columns:1fr;}}' +
        '@media (max-width:480px){.cc-row{grid-template-columns:24px 1fr;}.cc-row .cc-status{grid-column:1 / -1;}}' +
        '.cc-range{width:100%;accent-color:#e3b23c;}' +
        '</style>' +
        '<div id="cc-metrics" class="cc-metrics"></div>' +
        '<div class="cc-panel">' +
          '<p class="cc-title"><i data-lucide="sliders-horizontal" style="width:14px;height:14px"></i>Budget simulator</p>' +
          '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">' +
            '<span class="cc-mono" style="font-size:24px;color:var(--gold);font-weight:700;">$<span id="cc-budget-val">0</span>M</span>' +
            '<span style="color:var(--muted);font-size:12px;">Total budget available</span>' +
          '</div>' +
          '<input id="cc-slider" class="cc-range" type="range" min="0" max="300" step="1" value="0" aria-label="Budget in millions">' +
          '<div id="cc-sim-dep" style="margin-top:12px;"></div>' +
        '</div>' +
        '<div class="cc-panel">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
            '<p class="cc-title" style="margin:0"><i data-lucide="map-pin" style="width:14px;height:14px"></i>Geo-hotspot grid</p>' +
            '<div id="cc-toggle" class="cc-toggle" style="display:none;"><button data-mode="grid" class="on">Grid</button><button data-mode="map">Map</button></div>' +
          '</div>' +
          '<div id="cc-grid" class="cc-tiles"></div>' +
          '<div id="cc-map" style="display:none;"></div>' +
        '</div>' +
        '<div class="cc-two">' +
          '<div class="cc-panel"><p class="cc-title"><i data-lucide="bar-chart-3" style="width:14px;height:14px"></i>Budget by category</p><div id="cc-cat"></div></div>' +
          '<div class="cc-panel"><p class="cc-title"><i data-lucide="waves" style="width:14px;height:14px"></i>Funding waterfall</p><div id="cc-wf"></div></div>' +
        '</div>' +
        '<div class="cc-panel">' +
          '<p class="cc-title"><i data-lucide="list-ordered" style="width:14px;height:14px"></i>Allocation queue</p>' +
          '<div id="cc-queue" style="display:flex;flex-direction:column;gap:8px;"></div>' +
        '</div>' +
      '</div>';

    const $ = function(id){ return container.querySelector('#'+id); };
    const elMetrics = $('cc-metrics'), elSlider = $('cc-slider'), elBudgetVal = $('cc-budget-val'),
          elSimDep = $('cc-sim-dep'), elGrid = $('cc-grid'), elMap = $('cc-map'), elToggle = $('cc-toggle'),
          elCat = $('cc-cat'), elWf = $('cc-wf'), elQueue = $('cc-queue');

    // ---------- helpers ----------
    function getState(){ return CL.store.get(); }
    function eng(){ return CL.engines || {}; }
    function regions(){ return (CL.data && CL.data.REGIONS) || []; }
    function regionOf(id){ return regions().find(function(r){ return r.id === id; }); }

    function heat(t){
      // gold (#e3b23c) -> red (#fb7185)
      t = Math.max(0, Math.min(1, t));
      const a = [227,178,60], b = [251,113,133];
      const c = a.map(function(v,i){ return Math.round(v + (b[i]-v)*t); });
      return c;
    }

    function countUp(key, node, to, decimals, suffix){
      const from = anim[key] == null ? 0 : anim[key];
      if (rafs[key]) cancelAnimationFrame(rafs[key]);
      if (from === to){ node.textContent = (decimals ? f1(to) : fmt(to)) + (suffix||''); anim[key] = to; return; }
      const start = performance.now(), dur = 700;
      function step(now){
        const p = Math.min(1, (now-start)/dur), e = 1-Math.pow(1-p,3);
        const v = from + (to-from)*e;
        anim[key] = v;
        node.textContent = (decimals ? f1(v) : fmt(v)) + (suffix||'');
        if (p < 1) rafs[key] = requestAnimationFrame(step); else { anim[key] = to; }
      }
      rafs[key] = requestAnimationFrame(step);
    }

    function compute(){
      const s = getState(), E = eng();
      const incs = (s.incidents || []).slice();
      const scoreOf = function(i){ const r = regionOf(i.regionId); return r ? safe(function(){ return E.priorityScore(i, r); }, 0) : 0; };
      incs.forEach(function(i){ i.__score = scoreOf(i); });
      incs.sort(function(a,b){ return b.__score - a.__score; });
      const alloc = safe(function(){ return E.allocateBudget(); }, { byId:{}, used:0, remaining:s.budget||0 });
      return { s:s, incs:incs, alloc:alloc };
    }

    // ---------- metrics ----------
    const METRIC_DEFS = [
      { key:'citizensImpacted', label:'Citizens Impacted', icon:'users', dec:0, suffix:'' },
      { key:'activeHotspots', label:'Active Hotspots', icon:'flame', dec:0, suffix:'' },
      { key:'budgetUtilization', label:'Budget Utilization', icon:'wallet', dec:1, suffix:'%' },
      { key:'aiEfficiency', label:'AI Efficiency', icon:'cpu', dec:1, suffix:'%' }
    ];
    elMetrics.innerHTML = METRIC_DEFS.map(function(d){
      return '<div class="cc-panel"><div class="cc-metric-lbl"><i data-lucide="'+d.icon+'" style="width:14px;height:14px"></i>'+d.label+'</div>' +
        '<div class="cc-metric-val cc-mono" data-m="'+d.key+'">0</div>' +
        '<div class="cc-metric-sub" data-s="'+d.key+'" style="font-size:11px;color:var(--muted);margin-top:2px;"></div></div>';
    }).join('');

    function renderMetrics(){
      const m = safe(function(){ return eng().metrics(); }, null) || {};
      METRIC_DEFS.forEach(function(d){
        const node = elMetrics.querySelector('[data-m="'+d.key+'"]');
        const val = Number(m[d.key]) || 0;
        if (lastMetrics[d.key] !== val){
          lastMetrics[d.key] = val;
          countUp(d.key, node, val, d.dec, d.suffix);
        }
      });
      const sub = function(k, txt){ const n = elMetrics.querySelector('[data-s="'+k+'"]'); if (n) n.textContent = txt; };
      sub('citizensImpacted', 'from ' + fmt(m.totalReports||0) + ' micro-reports');
      sub('activeHotspots', 'urgency ≥ 7');
      sub('budgetUtilization', 'of allocated budget');
      sub('aiEfficiency', fmt(m.masterCount||0) + ' master incidents');
    }

    // ---------- budget simulator ----------
    function renderSimulator(c){
      const s = c.s;
      const cap = safe(function(){ return regions().reduce(function(a,r){ return a + (r.budgetCap||0); }, 0); }, 0);
      const E = eng();
      const demand = c.incs.reduce(function(a,i){ return a + (safe(function(){ return E.effectiveCost(i); }, i.estCost) || 0); }, 0);
      const coverage = demand > 0 ? Math.min(1, (s.budget||0) / demand) : 1;
      const deferred = c.incs.filter(function(i){ return c.alloc.byId[i.id] && c.alloc.byId[i.id].status === 'deferred'; });
      const partial = c.incs.filter(function(i){ return c.alloc.byId[i.id] && c.alloc.byId[i.id].status === 'partial'; });
      const deferredCost = deferred.reduce(function(a,i){ return a + (c.alloc.byId[i.id].cost || 0); }, 0);

      let sentence;
      if (!c.incs.length) sentence = 'No incidents are currently reported.';
      else if (!deferred.length && !partial.length) sentence = 'Every incident is fully funded with $' + f1(c.alloc.remaining) + 'M to spare.';
      else {
        const top = deferred.slice(0,2).map(function(i){ return esc(i.title); });
        sentence = (deferred.length ? deferred.length + ' incident' + (deferred.length>1?'s are':' is') + ' deferred ($' + f1(deferredCost) + 'M unfunded)' : 'No incidents are fully deferred') +
          (partial.length ? ', and "' + esc(partial[0].title) + '" is only partially funded' : '') +
          (top.length ? '. Next in line to miss out: ' + top.join(', ') : '') + '.';
      }
      const col = coverage >= 1 ? 'var(--ok)' : coverage >= .5 ? 'var(--warn)' : 'var(--bad)';
      elSimDep.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;">' +
          '<div><div class="k" style="font-size:11px;color:var(--muted)">Regional cap (sum)</div><div class="cc-mono" style="font-size:16px;">$' + fmt(cap) + 'M</div></div>' +
          '<div><div class="k" style="font-size:11px;color:var(--muted)">Full-demand total</div><div class="cc-mono" style="font-size:16px;">$' + f1(demand) + 'M</div></div>' +
          '<div><div class="k" style="font-size:11px;color:var(--muted)">Used / Remaining</div><div class="cc-mono" style="font-size:16px;">$' + f1(c.alloc.used) + 'M / $' + f1(c.alloc.remaining) + 'M</div></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px;"><span>Funding coverage</span><span class="cc-mono">' + f1(coverage*100) + '%</span></div>' +
        '<div class="cc-bar"><div style="width:' + (coverage*100) + '%;background:' + col + ';"></div></div>' +
        '<p style="margin:10px 0 0;font-size:13px;color:var(--text);line-height:1.5;">' + sentence + '</p>';
    }

    // ---------- hotspot grid ----------
    function renderGrid(c){
      const E = eng();
      const scores = regions().map(function(r){ return safe(function(){ return E.regionScore(r.id); }, 0) || 0; });
      const max = Math.max.apply(null, scores.concat([0.0001]));
      const ranked = scores.slice().sort(function(a,b){ return b-a; });
      const cutIdx = Math.max(0, Math.ceil(regions().length*0.3) - 1);
      const cut = ranked[cutIdx];
      elGrid.innerHTML = regions().map(function(r, idx){
        const sc = scores[idx];
        const rel = sc / max;
        const rgb = heat(rel);
        const incs = c.incs.filter(function(i){ return i.regionId === r.id; });
        const totalCost = incs.reduce(function(a,i){ const al = c.alloc.byId[i.id]; return a + (al ? al.cost : 0); }, 0);
        const funded = incs.reduce(function(a,i){ const al = c.alloc.byId[i.id]; return a + (al ? al.funded : 0); }, 0);
        const pct = totalCost > 0 ? Math.round(funded/totalCost*100) : 0;
        const hot = sc > 0 && sc >= cut;
        return '<div class="cc-tile' + (hot ? ' cc-pulse' : '') + '" style="background:rgba(' + rgb.join(',') + ',' + (0.10 + rel*0.28) + ');border-color:rgba(' + rgb.join(',') + ',' + (0.35 + rel*0.5) + ');">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">' +
            '<div><div style="font-weight:600;font-size:14px;">' + esc(r.name) + '</div><div class="k">' + esc(r.country) + '</div></div>' +
            '<span class="cc-mono" style="font-size:16px;font-weight:700;color:rgb(' + rgb.join(',') + ');">' + f1(sc) + '</span>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;margin-top:8px;">' +
            '<div><span class="k">Density </span><span class="v cc-mono">' + fmt(r.density) + 'k</span></div>' +
            '<div><span class="k">IDI </span><span class="v cc-mono">' + fmt(r.idi) + '</span></div>' +
            '<div><span class="k">Incidents </span><span class="v cc-mono">' + incs.length + '</span></div>' +
            '<div><span class="k">Funded </span><span class="v cc-mono">' + pct + '%</span></div>' +
          '</div>' +
          '<div class="cc-bar" style="margin-top:8px;height:5px;"><div style="width:' + pct + '%;background:var(--ok);"></div></div>' +
          (hot ? '<div style="position:absolute;top:6px;right:6px;"></div>' : '') +
        '</div>';
      }).join('');
    }

    // ---------- category stacked bar ----------
    function renderCategories(c){
      const cats = (CL.data && CL.data.CATEGORIES) || ['Water','Power','Roads','Waste','Transit','Sanitation'];
      const tot = {};
      cats.forEach(function(k){ tot[k] = 0; });
      c.incs.forEach(function(i){
        const al = c.alloc.byId[i.id];
        if (al && tot[i.category] != null) tot[i.category] += al.funded || 0;
      });
      const sum = cats.reduce(function(a,k){ return a + tot[k]; }, 0);
      if (sum <= 0){
        elCat.innerHTML = '<p style="color:var(--muted);font-size:13px;margin:0;">No funds allocated yet. Increase the budget to see the split.</p>';
        return;
      }
      let x = 0;
      const W = 600, H = 34;
      const segs = cats.map(function(k){
        const w = tot[k]/sum*W;
        const seg = '<rect x="' + x.toFixed(2) + '" y="0" width="' + w.toFixed(2) + '" height="' + H + '" fill="' + (CATCOL[k]||'#888') + '"><title>' + esc(k) + ': $' + f1(tot[k]) + 'M</title></rect>';
        x += w;
        return seg;
      }).join('');
      const legend = cats.filter(function(k){ return tot[k] > 0; }).map(function(k){
        return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;"><span style="width:10px;height:10px;border-radius:2px;background:' + (CATCOL[k]||'#888') + ';display:inline-block;"></span>' +
          '<span style="color:var(--muted)">' + esc(k) + '</span><span class="cc-mono">$' + f1(tot[k]) + 'M · ' + Math.round(tot[k]/sum*100) + '%</span></div>';
      }).join('');
      elCat.innerHTML =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:34px;border-radius:6px;display:block;" role="img" aria-label="Budget by category">' + segs + '</svg>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px 12px;margin-top:12px;">' + legend + '</div>';
    }

    // ---------- waterfall ----------
    function renderWaterfall(c){
      const budget = c.s.budget || 0;
      if (!c.incs.length){ elWf.innerHTML = '<p style="color:var(--muted);font-size:13px;margin:0;">No incidents.</p>'; return; }
      const E = eng();
      let running = 0, tip = null;
      const rows = c.incs.map(function(i){
        const cost = safe(function(){ return E.effectiveCost(i); }, i.estCost) || 0;
        const start = running;
        running += cost;
        const crosses = !tip && running > budget;
        if (crosses) tip = i;
        return { i:i, cost:cost, start:start, end:running, tip:crosses };
      });
      const total = Math.max(running, budget, 1);
      const shown = rows.slice(0, 14);
      const RH = 20, LW = 130, W = 600, CW = W - LW - 10, H = shown.length*RH + 16;
      const bx = LW + (budget/total)*CW;
      const bars = shown.map(function(r, idx){
        const y = idx*RH + 4;
        const x1 = LW + (r.start/total)*CW, w = Math.max(1.5, (r.cost/total)*CW);
        const st = c.alloc.byId[r.i.id] ? c.alloc.byId[r.i.id].status : 'deferred';
        const color = STATUS[st] ? STATUS[st].color : 'var(--muted)';
        const title = r.i.title.length > 20 ? r.i.title.slice(0,19) + '…' : r.i.title;
        return '<text x="' + (LW-6) + '" y="' + (y+11) + '" text-anchor="end" font-size="10" fill="' + (r.tip ? '#e3b23c' : '#8fa3b8') + '">' + esc(title) + '</text>' +
          '<rect x="' + x1.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="' + color + '" opacity="' + (r.tip ? 1 : .8) + '"' + (r.tip ? ' stroke="#e3b23c" stroke-width="1.5"' : '') + '><title>' + esc(r.i.title) + ': $' + f1(r.cost) + 'M (cumulative $' + f1(r.end) + 'M)</title></rect>';
      }).join('');
      const line = '<line x1="' + bx.toFixed(1) + '" y1="0" x2="' + bx.toFixed(1) + '" y2="' + H + '" stroke="#e3b23c" stroke-dasharray="4 3" stroke-width="1.5"/>' +
        '<text x="' + Math.min(bx+4, W-60).toFixed(1) + '" y="' + (H-3) + '" font-size="10" fill="#e3b23c">Budget $' + f1(budget) + 'M</text>';
      const msg = tip
        ? '<strong style="color:var(--gold)">' + esc(tip.title) + '</strong> tips the budget: cumulative demand passes $' + f1(budget) + 'M at this incident.'
        : 'Budget covers all demand ($' + f1(running) + 'M). No incident tips the budget.';
      elWf.innerHTML =
        '<div style="overflow-x:auto;"><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:420px;height:auto;display:block;" role="img" aria-label="Funding waterfall">' + bars + line + '</svg></div>' +
        '<p style="margin:8px 0 0;font-size:13px;line-height:1.5;">' + msg + '</p>' +
        (rows.length > shown.length ? '<p style="margin:4px 0 0;font-size:11px;color:var(--muted);">Showing top ' + shown.length + ' of ' + rows.length + ' incidents.</p>' : '');
    }

    // ---------- queue ----------
    function renderQueue(c){
      if (!c.incs.length){ elQueue.innerHTML = '<p style="color:var(--muted);font-size:13px;margin:0;">No incidents in queue.</p>'; return; }
      const selected = c.s.selectedIssueId;
      elQueue.innerHTML = c.incs.map(function(i, idx){
        const al = c.alloc.byId[i.id] || { status:'deferred', pct:0, funded:0, cost:i.estCost };
        const st = STATUS[al.status] || STATUS.deferred;
        const pct = Math.round((al.pct||0)*100);
        const label = al.status === 'partial' ? 'Partially Funded ' + pct + '%' : st.label;
        const region = regionOf(i.regionId);
        return '<div class="cc-row" data-id="' + esc(i.id) + '" role="button" tabindex="0" style="' + (selected === i.id ? 'border-color:var(--gold);' : '') + '">' +
          '<div class="cc-mono" style="color:var(--muted);font-size:13px;">' + (idx+1) + '</div>' +
          '<div style="min-width:0;">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
              '<span style="font-weight:600;font-size:14px;">' + esc(i.title) + '</span>' +
              '<span class="cc-mono" style="font-size:12px;color:var(--muted);">score ' + f1(i.__score) + '</span>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--muted);margin:2px 0 6px;">' + esc(i.category) + ' · ' + esc(region ? region.name : i.regionId) + ' · ' + esc(i.neighborhood||'') + ' · urgency ' + esc(i.urgency) + ' · $' + f1(al.cost) + 'M</div>' +
            '<div class="cc-bar"><div style="width:' + pct + '%;background:' + st.color + ';"></div></div>' +
          '</div>' +
          '<div class="cc-status" style="text-align:right;"><span class="cc-badge" style="color:' + st.color + ';border-color:' + st.color + ';">' + esc(label) + '</span></div>' +
        '</div>';
      }).join('');
    }

    // ---------- map / grid toggle ----------
    function applyMode(){
      const hasMap = !!(CL.widgets && CL.widgets.hotspotMap);
      elToggle.style.display = hasMap ? '' : 'none';
      if (!hasMap && viewMode === 'map') viewMode = 'grid';
      elToggle.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mode') === viewMode); });
      elGrid.style.display = viewMode === 'grid' ? '' : 'none';
      elMap.style.display = viewMode === 'map' ? '' : 'none';
      if (viewMode === 'map' && !mapCleanup && hasMap){
        elMap.innerHTML = '';
        mapCleanup = safe(function(){ return CL.widgets.hotspotMap(elMap, { height: 380 }); }, null) || function(){};
      } else if (viewMode !== 'map' && mapCleanup){
        safe(function(){ mapCleanup(); });
        mapCleanup = null;
        elMap.innerHTML = '';
      }
    }

    elToggle.addEventListener('click', function(e){
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      viewMode = b.getAttribute('data-mode');
      applyMode();
    });

    // ---------- events ----------
    elSlider.addEventListener('input', function(){
      const v = Number(elSlider.value);
      elBudgetVal.textContent = fmt(v);
      CL.store.update(function(st){ st.budget = v; });
    });

    function selectRow(row){
      if (!row) return;
      const id = row.getAttribute('data-id');
      CL.store.update(function(st){ st.selectedIssueId = id; });
      location.hash = '#blueprints';
    }
    elQueue.addEventListener('click', function(e){ selectRow(e.target.closest('.cc-row')); });
    elQueue.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){ const r = e.target.closest('.cc-row'); if (r){ e.preventDefault(); selectRow(r); } }
    });

    // ---------- render orchestration ----------
    function render(){
      const c = compute();
      // Slider: only sync value when the user is not dragging it
      if (document.activeElement !== elSlider && Number(elSlider.value) !== (c.s.budget||0)) elSlider.value = c.s.budget || 0;
      if (document.activeElement !== elSlider) elBudgetVal.textContent = fmt(c.s.budget || 0);
      renderMetrics();
      renderSimulator(c);
      renderGrid(c);
      renderCategories(c);
      renderWaterfall(c);
      renderQueue(c);
      applyMode();
      icons();
    }

    // initial slider value (set once)
    (function(){ const b = getState().budget || 0; elSlider.value = b; elBudgetVal.textContent = fmt(b); })();

    render();
    const off = CL.bus.on('state', render);

    return function cleanup(){
      if (typeof off === 'function') off();
      Object.keys(rafs).forEach(function(k){ cancelAnimationFrame(rafs[k]); });
      if (mapCleanup){ safe(function(){ mapCleanup(); }); mapCleanup = null; }
    };
  }

  if (CL.registerView){
    CL.registerView('command', { label:'Command Center', icon:'activity', order:1, mount:mount });
  }
})();
