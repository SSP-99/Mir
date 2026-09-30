(function(){
  const CL = window.CL = window.CL || {};
  CL.widgets = CL.widgets || {};

  /* ---------- helpers (safe fallbacks; never crash if a sibling file is missing) ---------- */
  let seq = 0;
  const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const STATUS_COLOR = { funded:'#34d399', partial:'#fbbf24', deferred:'#fb7185' };
  const STATUS_LABEL = { funded:'Funded', partial:'Partial', deferred:'Deferred' };

  function esc(s){
    if (CL.util && CL.util.esc) return CL.util.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function fmt(n){
    if (CL.util && CL.util.fmt) return CL.util.fmt(n);
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function f1(n){
    if (CL.util && CL.util.f1) return CL.util.f1(n);
    return (Math.round((n || 0) * 10) / 10).toFixed(1);
  }
  function icons(){ try { if (CL.util && CL.util.icons) CL.util.icons(); } catch(e){} }
  function getState(){
    try { if (CL.store && CL.store.get) return CL.store.get() || { incidents:[], plan:{} }; } catch(e){}
    return { incidents:[], plan:{} };
  }
  function getRegions(){ return (CL.data && CL.data.REGIONS) || []; }
  function getBlueprints(){ return (CL.data && CL.data.BLUEPRINTS) || []; }
  function subscribe(fn){
    try { if (CL.bus && CL.bus.on) return CL.bus.on('state', fn); } catch(e){}
    return null;
  }

  function ps(inc, region){
    try { if (CL.engines && CL.engines.priorityScore) return +CL.engines.priorityScore(inc, region) || 0; } catch(e){}
    return region && region.idi ? inc.urgency * region.density / region.idi : 0;
  }

  function effCost(st, inc){
    try { if (CL.engines && CL.engines.effectiveCost) return +CL.engines.effectiveCost(inc) || 0; } catch(e){}
    const bpId = st.plan && st.plan[inc.id];
    const bp = bpId ? getBlueprints().find(function(b){ return b.id === bpId; }) : null;
    return (inc.estCost || 0) * (1 - (bp ? bp.savingPct || 0 : 0));
  }

  function computeAlloc(st){
    try {
      if (CL.engines && CL.engines.allocateBudget) {
        const a = CL.engines.allocateBudget();
        if (a && a.byId) return a;
      }
    } catch(e){}
    const regions = getRegions();
    const rmap = {}; regions.forEach(function(r){ rmap[r.id] = r; });
    const list = (st.incidents || []).map(function(i){
      return { i:i, s: rmap[i.regionId] ? ps(i, rmap[i.regionId]) : 0 };
    }).sort(function(a,b){ return b.s - a.s; });
    let remaining = st.budget || 0, used = 0;
    const byId = {};
    list.forEach(function(x){
      const cost = effCost(st, x.i);
      if (remaining >= cost) { byId[x.i.id] = { status:'funded', pct:1, funded:cost, cost:cost }; remaining -= cost; used += cost; }
      else if (remaining > 0 && cost > 0) { byId[x.i.id] = { status:'partial', pct:remaining / cost, funded:remaining, cost:cost }; used += remaining; remaining = 0; }
      else byId[x.i.id] = { status:'deferred', pct:0, funded:0, cost:cost };
    });
    return { byId:byId, used:used, remaining:remaining };
  }

  function regionStats(st){
    const regions = getRegions();
    const alloc = computeAlloc(st);
    const incidents = st.incidents || [];
    const byId = {};
    const list = regions.map(function(r){
      const incs = incidents.filter(function(i){ return i.regionId === r.id; });
      const scored = incs.map(function(i){ return { i:i, s:ps(i, r) }; }).sort(function(a,b){ return b.s - a.s; });
      let score = scored.length ? scored[0].s : 0;
      try { if (CL.engines && CL.engines.regionScore) score = +CL.engines.regionScore(r.id) || 0; } catch(e){}
      let aff = 0, reached = 0;
      incs.forEach(function(i){
        const a = alloc.byId[i.id];
        aff += (i.clusterSize || 0) * 1200;
        reached += (i.clusterSize || 0) * 1200 * (a ? a.pct || 0 : 0);
      });
      const s = { region:r, incs:scored.map(function(x){ return x.i; }), scores:scored, score:score, aff:aff, reached:reached, top: scored.length ? scored[0].i : null };
      byId[r.id] = s;
      return s;
    });
    let maxScore = 0, maxAff = 0;
    list.forEach(function(s){ if (s.score > maxScore) maxScore = s.score; if (s.aff > maxAff) maxAff = s.aff; });
    return { list:list, byId:byId, maxScore:maxScore, maxAff:maxAff, alloc:alloc };
  }

  /* color scale: sky -> warn -> bad */
  const C_LOW = [56,189,248], C_MID = [251,191,36], C_HIGH = [251,113,133];
  function mix(a, b, t){ return a.map(function(v, i){ return Math.round(v + (b[i] - v) * t); }); }
  function scoreColor(t){
    t = Math.max(0, Math.min(1, t || 0));
    const c = t < 0.5 ? mix(C_LOW, C_MID, t / 0.5) : mix(C_MID, C_HIGH, (t - 0.5) / 0.5);
    return 'rgb(' + c.join(',') + ')';
  }

  /* projection: equirectangular into a 1000x500 space */
  function proj(lng, lat){ return [(lng + 180) / 360 * 1000, (90 - lat) / 180 * 500]; }
  function pathFrom(poly){
    return 'M' + poly.map(function(p){ return proj(p[0], p[1]).map(function(v){ return v.toFixed(1); }).join(','); }).join('L') + 'Z';
  }

  const LAND = [
    // North America
    [[-168,66],[-156,71],[-125,70],[-95,72],[-80,73],[-62,66],[-55,52],[-66,44],[-76,35],[-81,25],[-97,26],[-97,18],[-88,16],[-83,9],[-78,8],[-86,13],[-105,20],[-112,30],[-118,33],[-124,40],[-125,49],[-140,60],[-152,58],[-165,60]],
    // Greenland
    [[-73,78],[-40,83],[-20,80],[-22,70],[-43,60],[-55,68]],
    // South America
    [[-78,8],[-62,11],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-42],[-68,-52],[-72,-54],[-75,-45],[-71,-30],[-70,-18],[-81,-5],[-80,0]],
    // Eurasia
    [[-10,36],[-9,43],[-2,48],[5,52],[10,56],[20,60],[28,70],[45,68],[70,73],[100,77],[140,72],[170,70],[180,66],[160,58],[142,52],[135,43],[127,38],[122,30],[110,20],[106,10],[100,13],[103,1],[98,8],[92,20],[80,15],[77,8],[72,20],[66,25],[57,25],[50,30],[44,13],[35,28],[35,36],[27,37],[20,40],[15,38],[8,44],[-2,37]],
    // Africa
    [[-17,21],[-10,35],[10,37],[32,31],[35,28],[43,12],[51,12],[40,-3],[40,-15],[35,-25],[20,-35],[15,-28],[12,-15],[9,0],[-8,4],[-17,14]],
    // Australia
    [[114,-22],[122,-18],[136,-12],[142,-11],[153,-26],[147,-38],[135,-35],[116,-35]],
    // Sumatra, Java, Borneo
    [[95,5],[98,0],[104,-5],[106,-6],[101,-2]],
    [[105,-6],[114,-8],[114,-7]],
    [[109,1],[117,7],[119,1],[116,-4],[110,-3]],
    // Japan, UK, Madagascar, New Zealand
    [[130,32],[135,35],[141,40],[142,45],[140,36]],
    [[-5,50],[1,52],[-3,58]],
    [[44,-25],[50,-15],[47,-13]],
    [[172,-35],[178,-38],[174,-41],[168,-46],[172,-41]]
  ];

  function ensureStyle(){
    if (document.getElementById('clm-style')) return;
    const s = document.createElement('style');
    s.id = 'clm-style';
    s.textContent =
      '.clm-wrap{display:flex;flex-wrap:wrap;gap:12px}' +
      '.clm-stage{flex:1 1 520px;min-width:0;position:relative;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px;overflow:hidden}' +
      '.clm-panel{flex:0 0 300px;max-width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;max-height:520px;overflow:auto}' +
      '@media(max-width:860px){.clm-panel{flex:1 1 100%;max-height:none}}' +
      '.clm-tip{position:absolute;display:none;pointer-events:none;z-index:20;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--text);min-width:170px;max-width:240px;box-shadow:0 8px 24px rgba(0,0,0,.5)}' +
      '.clm-mono{font-family:' + MONO + '}' +
      '.clm-r{cursor:pointer;outline:none}' +
      '.clm-r:focus-visible .clm-core{stroke:#fff;stroke-width:2.5}' +
      '.clm-lbl{fill:#dbe4ee;font-size:11px;text-anchor:middle;paint-order:stroke;stroke:#0a1018;stroke-width:3px;pointer-events:none}' +
      '.clm-pulse{transform-box:fill-box;transform-origin:center;animation:clm-pulse 2.6s ease-out infinite}' +
      '@keyframes clm-pulse{0%{transform:scale(.7);opacity:.8}100%{transform:scale(2);opacity:0}}' +
      '.clm-arc{stroke-dasharray:6 6;animation:clm-dash 1.2s linear infinite}' +
      '@keyframes clm-dash{to{stroke-dashoffset:-24}}' +
      '@media(prefers-reduced-motion:reduce){.clm-pulse,.clm-arc{animation:none}.clm-pulse{opacity:.35}}' +
      '.clm-row{display:block;width:100%;text-align:left;background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px;color:var(--text);cursor:pointer;font-size:13px}' +
      '.clm-row:hover{border-color:var(--sky)}' +
      '.clm-x{background:transparent;border:1px solid var(--line);border-radius:8px;color:var(--muted);padding:4px;cursor:pointer;line-height:0}' +
      '.clm-x:hover{color:var(--text);border-color:var(--muted)}' +
      '.clm-pill{display:inline-block;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid;white-space:nowrap}';
    document.head.appendChild(s);
  }

  /* ---------- widget ---------- */
  function hotspotMap(container, opts){
    opts = opts || {};
    ensureStyle();
    const id = 'clm' + (++seq);
    const H = opts.height != null ? (typeof opts.height === 'number' ? opts.height + 'px' : String(opts.height)) : '420px';
    let pinned = null;
    let stats = regionStats(getState());

    let grat = '';
    for (let lo = -150; lo <= 150; lo += 30) { const p = proj(lo, 0)[0]; grat += '<path d="M' + p + ',20V420" />'; }
    for (let la = -60; la <= 60; la += 30) { const p = proj(0, la)[1]; grat += '<path d="M0,' + p + 'H1000" />'; }
    const land = LAND.map(function(p){ return '<path d="' + pathFrom(p) + '"/>'; }).join('');

    container.innerHTML =
      '<div class="clm-wrap">' +
        '<div class="clm-stage" data-stage>' +
          '<svg viewBox="0 20 1000 400" role="img" aria-label="Global hotspot map" style="width:100%;height:auto;max-height:' + esc(H) + ';display:block;border-radius:8px">' +
            '<defs>' +
              '<filter id="' + id + '-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
              '<radialGradient id="' + id + '-bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0f1c2b"/><stop offset="1" stop-color="#080e15"/></radialGradient>' +
            '</defs>' +
            '<rect x="0" y="20" width="1000" height="400" fill="url(#' + id + '-bg)" data-ocean/>' +
            '<g style="stroke:var(--line);stroke-width:.6;opacity:.55;fill:none">' + grat + '</g>' +
            '<g style="fill:#152437;stroke:#28405a;stroke-width:1;stroke-linejoin:round">' + land + '</g>' +
            '<g data-layer="arcs"></g>' +
            '<g data-layer="bubbles"></g>' +
          '</svg>' +
          '<div class="clm-tip" data-tip></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding:8px 4px 2px;font-size:11px;color:var(--muted)">' +
            '<span style="display:flex;align-items:center;gap:6px">Priority score <span style="display:inline-block;width:70px;height:8px;border-radius:4px;background:linear-gradient(90deg,#38bdf8,#fbbf24,#fb7185)"></span> low&rarr;high</span>' +
            '<span>Bubble size = citizens affected</span>' +
            '<span style="display:flex;align-items:center;gap:6px"><svg width="26" height="8"><path d="M0,4H26" stroke="#e3b23c" stroke-width="2" stroke-dasharray="4 3" fill="none"/></svg>Blueprint transfer</span>' +
          '</div>' +
        '</div>' +
        '<aside class="clm-panel" data-panel aria-live="polite"></aside>' +
      '</div>';

    const svg = container.querySelector('svg');
    const stage = container.querySelector('[data-stage]');
    const tip = container.querySelector('[data-tip]');
    const panel = container.querySelector('[data-panel]');
    const arcsLayer = container.querySelector('[data-layer="arcs"]');
    const bubbleLayer = container.querySelector('[data-layer="bubbles"]');

    function renderArcs(st){
      const bps = getBlueprints();
      const rmap = {}; getRegions().forEach(function(r){ rmap[r.id] = r; });
      const pairs = {};
      Object.keys(st.plan || {}).forEach(function(incId){
        const inc = (st.incidents || []).find(function(i){ return i.id === incId; });
        const bp = bps.find(function(b){ return b.id === st.plan[incId]; });
        if (!inc || !bp) return;
        const src = rmap[bp.fromRegionId], tgt = rmap[inc.regionId];
        if (!src || !tgt || src.id === tgt.id) return;
        const key = src.id + '>' + tgt.id;
        if (!pairs[key]) pairs[key] = { src:src, tgt:tgt, n:0, titles:[] };
        pairs[key].n++; pairs[key].titles.push(bp.title);
      });
      let out = '';
      Object.keys(pairs).forEach(function(k){
        const p = pairs[k];
        const a = proj(p.src.lng, p.src.lat), b = proj(p.tgt.lng, p.tgt.lat);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const cy = my - Math.min(dist * 0.35, 130) - 10;
        const d = 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' Q' + mx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);
        out += '<g>' +
          '<path class="clm-arc" d="' + d + '" fill="none" stroke="#e3b23c" stroke-opacity=".8" stroke-width="' + (1.4 + Math.min(p.n, 4) * 0.4) + '" stroke-linecap="round"><title>' + esc(p.src.name + ' \u2192 ' + p.tgt.name + ': ' + p.titles.join(', ')) + '</title></path>' +
          '<circle r="3.2" fill="#e3b23c" filter="url(#' + id + '-glow)"><animateMotion dur="3.2s" repeatCount="indefinite" path="' + d + '"/></circle>' +
          '<circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="4" fill="none" stroke="#e3b23c" stroke-width="1.2" opacity=".8"/>' +
        '</g>';
      });
      arcsLayer.innerHTML = out;
    }

    function renderBubbles(){
      let out = '';
      stats.list.forEach(function(s, idx){
        const r = s.region;
        const p = proj(r.lng, r.lat);
        const has = s.incs.length > 0;
        const rad = has ? 7 + 26 * Math.sqrt(stats.maxAff > 0 ? s.aff / stats.maxAff : 0) : 5;
        const col = has ? scoreColor(stats.maxScore > 0 ? s.score / stats.maxScore : 0) : '#8fa3b8';
        const cx = p[0].toFixed(1), cy = p[1].toFixed(1);
        out += '<g class="clm-r" data-id="' + esc(r.id) + '" tabindex="0" role="button" aria-pressed="' + (pinned === r.id) + '" aria-label="' + esc(r.name + ', ' + s.incs.length + ' incidents, priority score ' + f1(s.score)) + '">' +
          (has ? '<circle class="clm-pulse" cx="' + cx + '" cy="' + cy + '" r="' + rad.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="2" style="animation-delay:' + (idx * 0.33).toFixed(2) + 's"/>' : '') +
          '<circle class="clm-core" cx="' + cx + '" cy="' + cy + '" r="' + rad.toFixed(1) + '" fill="' + col + '" fill-opacity="' + (has ? 0.35 : 0.15) + '" stroke="' + col + '" stroke-width="1.5" filter="url(#' + id + '-glow)"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + Math.max(2.5, rad * 0.28).toFixed(1) + '" fill="' + col + '"/>' +
          (pinned === r.id ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rad + 6).toFixed(1) + '" fill="none" stroke="#e3b23c" stroke-width="1.6" stroke-dasharray="3 3"/>' : '') +
          '<text class="clm-lbl" x="' + cx + '" y="' + (p[1] + rad + 14).toFixed(1) + '">' + esc(r.name) + '</text>' +
        '</g>';
      });
      bubbleLayer.innerHTML = out;
    }

    function pill(status, pct){
      const c = STATUS_COLOR[status] || '#8fa3b8';
      return '<span class="clm-pill" style="color:' + c + ';border-color:' + c + '">' + esc(STATUS_LABEL[status] || status) + (status === 'partial' ? ' ' + Math.round(pct * 100) + '%' : '') + '</span>';
    }

    function renderPanel(st){
      const prevScroll = panel.scrollTop;
      const s = pinned ? stats.byId[pinned] : null;
      let html = '';
      if (pinned && !s) pinned = null;
      if (s) {
        const r = s.region;
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px">' +
          '<div><div style="font-weight:600;font-size:15px">' + esc(r.name) + '</div><div style="font-size:12px;color:var(--muted)">' + esc(r.country) + '</div></div>' +
          '<button class="clm-x" data-act="clear" aria-label="Clear selection"><i data-lucide="x" style="width:16px;height:16px"></i></button></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' +
            [['IDI', r.idi], ['Density', fmt(r.density) + 'k/km\u00b2'], ['Budget cap', '$' + fmt(r.budgetCap) + 'M'], ['Region score', f1(s.score)]].map(function(x){
              return '<div style="border:1px solid var(--line);border-radius:8px;padding:6px 8px"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">' + x[0] + '</div><div class="clm-mono" style="font-size:14px">' + esc(x[1]) + '</div></div>';
            }).join('') +
          '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Incidents (' + s.incs.length + ')</div>';
        if (!s.incs.length) html += '<div style="font-size:13px;color:var(--muted)">No open incidents in this region.</div>';
        s.incs.forEach(function(i){
          const a = stats.alloc.byId[i.id];
          const status = a ? a.status : 'deferred';
          const sc = STATUS_COLOR[status];
          const sel = st.selectedIssueId === i.id;
          html += '<button class="clm-row" data-inc="' + esc(i.id) + '" style="border-left:3px solid ' + sc + ';' + (sel ? 'background:rgba(56,189,248,.08);border-color:var(--sky);border-left-color:' + sc : '') + '">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><span style="font-weight:600">' + esc(i.title) + '</span>' + pill(status, a ? a.pct : 0) + '</div>' +
            '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + esc(i.neighborhood) + ' \u00b7 ' + esc(i.category) + ' \u00b7 SLA ' + esc(i.slaHours) + 'h</div>' +
            '<div class="clm-mono" style="font-size:11px;margin-top:4px;color:var(--text)">Urgency ' + esc(i.urgency) + '/10 \u00b7 $' + f1(effCost(st, i)) + 'M \u00b7 ' + fmt(i.clusterSize) + ' reports</div>' +
          '</button>';
        });
      } else {
        html += '<div style="font-weight:600;margin-bottom:4px">Regions by priority</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Click a region on the map (or below) to pin its incidents.</div>';
        const ranked = stats.list.slice().sort(function(a, b){ return b.score - a.score; });
        if (!ranked.length) html += '<div style="font-size:13px;color:var(--muted)">No regions loaded.</div>';
        ranked.forEach(function(x){
          const col = x.incs.length ? scoreColor(stats.maxScore > 0 ? x.score / stats.maxScore : 0) : '#8fa3b8';
          html += '<button class="clm-row" data-pin="' + esc(x.region.id) + '" style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
            '<span style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:' + col + ';box-shadow:0 0 8px ' + col + '"></span>' + esc(x.region.name) + '</span>' +
            '<span class="clm-mono" style="font-size:12px;color:var(--muted)">' + x.incs.length + ' inc \u00b7 ' + f1(x.score) + '</span></button>';
        });
      }
      panel.innerHTML = html;
      panel.scrollTop = prevScroll;
      icons();
    }

    function update(){
      const st = getState();
      stats = regionStats(st);
      if (pinned && !stats.byId[pinned]) pinned = null;
      renderArcs(st);
      renderBubbles();
      renderPanel(st);
    }

    /* tooltip */
    function tipHtml(s){
      const r = s.region;
      let h = '<div style="font-weight:600;margin-bottom:4px">' + esc(r.name) + ', ' + esc(r.country) + '</div>' +
        '<div class="clm-mono" style="line-height:1.6">IDI: ' + esc(r.idi) + '<br>Density: ' + fmt(r.density) + 'k/km\u00b2<br>Incidents: ' + s.incs.length + '<br>Score: ' + f1(s.score) + '<br>Affected: ' + fmt(s.aff) + '<br>Reached: ' + fmt(s.reached) + '</div>';
      h += s.top
        ? '<div style="margin-top:6px;border-top:1px solid var(--line);padding-top:6px"><span style="color:var(--muted)">Top issue:</span> ' + esc(s.top.title) + ' <span class="clm-mono" style="color:var(--muted)">(U' + esc(s.top.urgency) + ', ' + esc(s.top.category) + ')</span></div>'
        : '<div style="margin-top:6px;color:var(--muted)">No open incidents</div>';
      return h;
    }
    function showTip(g, clientX, clientY){
      const s = stats.byId[g.getAttribute('data-id')];
      if (!s) return;
      tip.innerHTML = tipHtml(s);
      tip.style.display = 'block';
      const wr = stage.getBoundingClientRect();
      let x = clientX - wr.left + 14, y = clientY - wr.top + 14;
      if (x + tip.offsetWidth > wr.width - 4) x = clientX - wr.left - tip.offsetWidth - 14;
      if (y + tip.offsetHeight > wr.height - 4) y = clientY - wr.top - tip.offsetHeight - 14;
      tip.style.left = Math.max(4, x) + 'px';
      tip.style.top = Math.max(4, y) + 'px';
    }
    function hideTip(){ tip.style.display = 'none'; }

    function onMove(e){
      const g = e.target.closest ? e.target.closest('.clm-r') : null;
      if (g) showTip(g, e.clientX, e.clientY); else hideTip();
    }
    function onClick(e){
      const g = e.target.closest ? e.target.closest('.clm-r') : null;
      pinned = g ? (pinned === g.getAttribute('data-id') ? null : g.getAttribute('data-id')) : null;
      update();
    }
    function onKey(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest ? e.target.closest('.clm-r') : null;
      if (!g) return;
      e.preventDefault();
      const rid = g.getAttribute('data-id');
      pinned = pinned === rid ? null : rid;
      update();
      const again = svg.querySelector('.clm-r[data-id="' + rid + '"]');
      if (again) again.focus();
    }
    function onFocus(e){
      const g = e.target.closest ? e.target.closest('.clm-r') : null;
      if (!g) return;
      const b = g.getBoundingClientRect();
      showTip(g, b.left + b.width / 2, b.top + b.height / 2);
    }
    function onPanel(e){
      const t = e.target.closest ? e.target.closest('[data-act],[data-inc],[data-pin]') : null;
      if (!t) return;
      if (t.hasAttribute('data-act')) { pinned = null; update(); }
      else if (t.hasAttribute('data-pin')) { pinned = t.getAttribute('data-pin'); update(); }
      else if (t.hasAttribute('data-inc')) {
        const iid = t.getAttribute('data-inc');
        try { if (CL.store && CL.store.update) CL.store.update(function(s){ s.selectedIssueId = iid; }); } catch(err){}
      }
    }

    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseleave', hideTip);
    svg.addEventListener('click', onClick);
    svg.addEventListener('keydown', onKey);
    svg.addEventListener('focusin', onFocus);
    svg.addEventListener('focusout', hideTip);
    panel.addEventListener('click', onPanel);

    update();
    icons();
    const off = subscribe(update);

    return function cleanup(){
      if (typeof off === 'function') off();
      svg.removeEventListener('mousemove', onMove);
      svg.removeEventListener('mouseleave', hideTip);
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('keydown', onKey);
      svg.removeEventListener('focusin', onFocus);
      svg.removeEventListener('focusout', hideTip);
      panel.removeEventListener('click', onPanel);
      container.innerHTML = '';
    };
  }
  CL.widgets.hotspotMap = hotspotMap;

  /* ---------- charts (inline SVG) ---------- */
  function emptySVG(msg){
    return '<svg viewBox="0 0 420 120" style="width:100%;height:auto;display:block"><text x="210" y="64" text-anchor="middle" fill="#8fa3b8" font-size="12">' + esc(msg) + '</text></svg>';
  }

  function barsSVG(rs){
    const rows = rs.list.slice().sort(function(a, b){ return b.score - a.score; });
    if (!rows.length) return emptySVG('No regions loaded');
    const W = 420, rh = 26, top = 6, lx = 96, rx = 50, H = top * 2 + rows.length * rh;
    let out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Priority score by region" style="width:100%;height:auto;display:block">';
    rows.forEach(function(r, i){
      const y = top + i * rh;
      const w = rs.maxScore > 0 ? (r.score / rs.maxScore) * (W - lx - rx) : 0;
      const col = r.incs.length ? scoreColor(rs.maxScore > 0 ? r.score / rs.maxScore : 0) : '#8fa3b8';
      out += '<text x="' + (lx - 8) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end" fill="#8fa3b8" font-size="11">' + esc(r.region.name) + '</text>' +
        '<rect x="' + lx + '" y="' + (y + 5) + '" width="' + Math.max(w, 2).toFixed(1) + '" height="' + (rh - 10) + '" rx="3" fill="' + col + '" opacity=".9"/>' +
        '<text x="' + (lx + Math.max(w, 2) + 6).toFixed(1) + '" y="' + (y + rh / 2 + 4) + '" fill="#dbe4ee" font-size="11" font-family="' + MONO + '">' + f1(r.score) + '</text>';
    });
    return out + '</svg>';
  }

  function histSVG(st){
    const counts = [0,0,0,0,0,0,0,0,0,0];
    (st.incidents || []).forEach(function(i){
      const u = Math.max(1, Math.min(10, Math.round(i.urgency || 1)));
      counts[u - 1]++;
    });
    const W = 420, H = 210, pl = 26, pr = 8, pt = 18, pb = 26;
    const cw = W - pl - pr, ch = H - pt - pb, bw = cw / 10;
    const max = Math.max(1, Math.max.apply(null, counts));
    const base = pt + ch;
    let out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Urgency distribution" style="width:100%;height:auto;display:block">';
    [0, max].forEach(function(v){
      const y = base - v / max * ch;
      out += '<path d="M' + pl + ',' + y + 'H' + (W - pr) + '" stroke="#1e2c3b" stroke-width="1"/>' +
        '<text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" fill="#8fa3b8" font-size="10" font-family="' + MONO + '">' + v + '</text>';
    });
    counts.forEach(function(c, i){
      const u = i + 1;
      const col = u >= 7 ? '#fb7185' : (u >= 5 ? '#fbbf24' : '#38bdf8');
      const h = c / max * ch;
      const x = pl + i * bw + 3;
      out += '<rect x="' + x.toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + col + '" opacity=".9"/>' +
        (c > 0 ? '<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (base - h - 5).toFixed(1) + '" text-anchor="middle" fill="#dbe4ee" font-size="10" font-family="' + MONO + '">' + c + '</text>' : '') +
        '<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (base + 15) + '" text-anchor="middle" fill="#8fa3b8" font-size="10" font-family="' + MONO + '">' + u + '</text>';
    });
    const hx = pl + 6 * bw;
    out += '<path d="M' + hx + ',' + (pt - 6) + 'V' + base + '" stroke="#e3b23c" stroke-dasharray="3 3" stroke-width="1"/>' +
      '<text x="' + (hx + 4) + '" y="' + (pt - 2) + '" fill="#e3b23c" font-size="10">hotspot \u2265 7</text>';
    return out + '</svg>';
  }

  function donutSVG(rs, st){
    const byId = rs.alloc.byId || {};
    const groups = { funded:{ n:0, f:0, c:0 }, partial:{ n:0, f:0, c:0 }, deferred:{ n:0, f:0, c:0 } };
    (st.incidents || []).forEach(function(i){
      const a = byId[i.id];
      if (!a || !groups[a.status]) return;
      const g = groups[a.status];
      g.n++; g.f += a.funded || 0; g.c += a.cost || 0;
    });
    const total = groups.funded.n + groups.partial.n + groups.deferred.n;
    const budget = st.budget || 0;
    const used = rs.alloc.used || 0;
    const util = budget > 0 ? used / budget * 100 : 0;
    const cx = 100, cy = 100, r = 64, sw = 26, C = 2 * Math.PI * r;
    let out = '<svg viewBox="0 0 420 200" role="img" aria-label="Funded versus deferred incidents" style="width:100%;height:auto;display:block">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#1e2c3b" stroke-width="' + sw + '"/>';
    let acc = 0;
    if (total > 0) {
      ['funded', 'partial', 'deferred'].forEach(function(k){
        const g = groups[k];
        if (!g.n) return;
        const len = g.n / total * C;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + STATUS_COLOR[k] + '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
        acc += len;
      });
    }
    out += '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" fill="#dbe4ee" font-size="20" font-family="' + MONO + '">' + f1(util) + '%</text>' +
      '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" fill="#8fa3b8" font-size="10">budget used</text>';
    ['funded', 'partial', 'deferred'].forEach(function(k, i){
      const g = groups[k], y = 46 + i * 44;
      out += '<rect x="196" y="' + (y - 10) + '" width="12" height="12" rx="3" fill="' + STATUS_COLOR[k] + '"/>' +
        '<text x="216" y="' + y + '" fill="#dbe4ee" font-size="12">' + STATUS_LABEL[k] + ' <tspan fill="#8fa3b8" font-family="' + MONO + '">\u00b7 ' + g.n + '</tspan></text>' +
        '<text x="216" y="' + (y + 16) + '" fill="#8fa3b8" font-size="11" font-family="' + MONO + '">$' + f1(g.f) + 'M / $' + f1(g.c) + 'M</text>';
    });
    return out + '</svg>';
  }

  /* ---------- view ---------- */
  function mount(container){
    const card = 'background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;min-width:0';
    container.innerHTML =
      '<div class="p-4 md:p-6" style="display:flex;flex-direction:column;gap:16px">' +
        '<div><h2 style="font-size:20px;font-weight:600;color:var(--text);margin:0;display:flex;align-items:center;gap:8px"><i data-lucide="globe" style="width:20px;height:20px;color:var(--gold)"></i>Global Map</h2>' +
        '<p style="margin:4px 0 0;font-size:13px;color:var(--muted)">Live hotspot view across BRICS+ regions, with cross-border blueprint transfers.</p></div>' +
        '<div data-map></div>' +
        '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">' +
          '<section style="' + card + '"><h3 style="margin:0 0 2px;font-size:14px;font-weight:600;color:var(--text)">Priority score by region</h3><p style="margin:0 0 10px;font-size:11px;color:var(--muted)">Max urgency \u00d7 density \u00f7 IDI</p><div data-chart="bars"></div></section>' +
          '<section style="' + card + '"><h3 style="margin:0 0 2px;font-size:14px;font-weight:600;color:var(--text)">Urgency distribution</h3><p style="margin:0 0 10px;font-size:11px;color:var(--muted)">Incidents per urgency level (1\u201310)</p><div data-chart="hist"></div></section>' +
          '<section style="' + card + '"><h3 style="margin:0 0 2px;font-size:14px;font-weight:600;color:var(--text)">Funded vs deferred</h3><p style="margin:0 0 10px;font-size:11px;color:var(--muted)">Incidents by allocation status</p><div data-chart="donut"></div></section>' +
        '</div>' +
      '</div>';

    const mapHost = container.querySelector('[data-map]');
    const elBars = container.querySelector('[data-chart="bars"]');
    const elHist = container.querySelector('[data-chart="hist"]');
    const elDonut = container.querySelector('[data-chart="donut"]');

    let cleanupMap = null;
    try { cleanupMap = CL.widgets.hotspotMap(mapHost, { height: 520 }); } catch(e){}

    function renderCharts(){
      const st = getState();
      const rs = regionStats(st);
      elBars.innerHTML = barsSVG(rs);
      elHist.innerHTML = histSVG(st);
      elDonut.innerHTML = donutSVG(rs, st);
    }
    renderCharts();
    icons();
    const off = subscribe(renderCharts);

    return function cleanup(){
      if (typeof off === 'function') off();
      if (typeof cleanupMap === 'function') cleanupMap();
    };
  }

  if (typeof CL.registerView === 'function') {
    CL.registerView('map', { label:'Global Map', icon:'globe', order:4, mount:mount });
  }
})();
