// js/views/ledger.js
(function () {
  const CL = window.CL = window.CL || {};

  const expanded = new Set();
  const languageMode = {};
  let cleanupState = null;
  let timer = null;
  let currentFiltered = [];

  function esc(v) {
    return CL.util && CL.util.esc ? CL.util.esc(v == null ? "" : String(v)) : String(v == null ? "" : v);
  }

  function fmt(v) {
    return CL.util && CL.util.fmt ? CL.util.fmt(v) : Number(v || 0).toLocaleString();
  }

  function f1(v) {
    return CL.util && CL.util.f1 ? CL.util.f1(v) : Number(v || 0).toFixed(1);
  }

  function safeDate(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function getAllocation(state) {
    try {
      return CL.engines && CL.engines.allocateBudget
        ? CL.engines.allocateBudget(state.budget)
        : { byId: {}, used: 0, remaining: state.budget || 0 };
    } catch (e) {
      return { byId: {}, used: 0, remaining: state.budget || 0 };
    }
  }

  function priority(incident) {
    const region = CL.data.REGIONS.find(r => r.id === incident.regionId);
    try {
      return CL.engines.priorityScore(incident, region) || 0;
    } catch (e) {
      return Number(incident.urgency || 0);
    }
  }

  function regionById(id) {
    return CL.data.REGIONS.find(r => r.id === id) || {
      id: id,
      name: id || "Unknown region",
      country: ""
    };
  }

  function statusFor(incident, allocation) {
    return allocation.byId[incident.id] || {
      status: "deferred",
      pct: 0,
      funded: 0,
      cost: incident.estCost || 0
    };
  }

  function statusClass(status) {
    return {
      funded: "ledger-funded",
      partial: "ledger-partial",
      deferred: "ledger-deferred"
    }[status] || "ledger-deferred";
  }

  function statusLabel(status) {
    return String(status || "deferred").toUpperCase();
  }

  function sentimentClass(sentiment) {
    if (sentiment === "Positive") return "ledger-positive";
    if (sentiment === "Negative") return "ledger-negative";
    return "ledger-neutral";
  }

  function urgencyClass(n) {
    if (n >= 8) return "ledger-urgency-high";
    if (n >= 5) return "ledger-urgency-mid";
    return "ledger-urgency-low";
  }

  function slaInfo(incident) {
    const created = safeDate(incident.createdAt);
    if (!created || !incident.slaHours) {
      return {
        breached: false,
        text: "SLA —",
        timestamp: null
      };
    }

    const deadline = created.getTime() + Number(incident.slaHours) * 3600000;
    const diff = deadline - Date.now();

    if (diff <= 0) {
      const overdue = Math.abs(diff);
      return {
        breached: true,
        text: "BREACHED · " + formatDuration(overdue),
        timestamp: deadline
      };
    }

    return {
      breached: false,
      text: "SLA " + formatDuration(diff),
      timestamp: deadline
    };
  }

  function formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return days + "d " + hours + "h";
    if (hours > 0) return hours + "h " + minutes + "m";
    return minutes + "m";
  }

  function getReports(incident) {
    return Array.isArray(incident.reports) ? incident.reports.slice(0, 8) : [];
  }

  function maskedReport(report, state) {
    try {
      return CL.engines.maskReport(report, !!state.anonymize) || report;
    } catch (e) {
      return report;
    }
  }

  function getReportText(report, state, mode) {
    const r = maskedReport(report, state);
    return mode === "english"
      ? (r.englishText || r.originalText || "")
      : (r.originalText || r.englishText || "");
  }

  function csvEscape(value) {
    const s = value == null ? "" : String(value);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsv(state) {
    const rows = currentFiltered || [];
    const header = [
      "Incident ID",
      "Region",
      "Country",
      "Neighborhood",
      "Category",
      "Urgency",
      "Priority",
      "Sentiment",
      "Cluster Size",
      "Estimated Cost ($M)",
      "Funding Status",
      "Funding %",
      "SLA",
      "Title",
      "Reports"
    ];

    const data = rows.map(incident => {
      const region = regionById(incident.regionId);
      const allocation = getAllocation(state);
      const funding = statusFor(incident, allocation);
      const reports = getReports(incident)
        .map(r => {
          const m = maskedReport(r, state);
          return (m.originalText || m.englishText || "").replace(/\s+/g, " ").trim();
        })
        .join(" || ");

      return [
        incident.id,
        region.name,
        region.country,
        incident.neighborhood,
        incident.category,
        incident.urgency,
        f1(priority(incident)),
        incident.sentiment,
        incident.clusterSize,
        incident.estCost,
        funding.status,
        Math.round((funding.pct || 0) * 100),
        slaInfo(incident).text,
        incident.title,
        reports
      ].map(csvEscape).join(",");
    });

    const csv = [header.map(csvEscape).join(","), ...data].join("\r\n");

    if (CL.util && CL.util.download) {
      CL.util.download(
        "civiclens-incident-ledger.csv",
        csv,
        "text/csv;charset=utf-8"
      );
    }
  }

  function incidentMatches(incident, controls, allocation) {
    const region = controls.region;
    const category = controls.category;
    const status = controls.status;
    const search = controls.search.trim().toLowerCase();
    const minUrgency = Number(controls.minUrgency || 1);
    const maxUrgency = Number(controls.maxUrgency || 10);

    if (region && incident.regionId !== region) return false;
    if (category && incident.category !== category) return false;

    const funding = statusFor(incident, allocation);
    if (status && funding.status !== status) return false;

    const urgency = Number(incident.urgency || 0);
    if (urgency < minUrgency || urgency > maxUrgency) return false;

    if (search) {
      const haystack = [
        incident.id,
        incident.title,
        incident.neighborhood,
        incident.category,
        incident.sentiment,
        regionById(incident.regionId).name,
        regionById(incident.regionId).country,
        ...getReports(incident).flatMap(r => [
          r.originalText,
          r.englishText,
          r.name
        ])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    return true;
  }

  function getControls(root) {
    return {
      region: root.querySelector("#ledger-region")?.value || "",
      category: root.querySelector("#ledger-category")?.value || "",
      status: root.querySelector("#ledger-status")?.value || "",
      minUrgency: root.querySelector("#ledger-min-urgency")?.value || "1",
      maxUrgency: root.querySelector("#ledger-max-urgency")?.value || "10",
      search: root.querySelector("#ledger-search")?.value || "",
      sort: root.querySelector("#ledger-sort")?.value || "priority"
    };
  }

  function buildStyles() {
    return `
      <style>
        .ledger-wrap{color:var(--text,#dbe4ee);font-family:inherit}
        .ledger-panel{background:var(--panel,#0f1823);border:1px solid var(--line,#1e2c3b);border-radius:10px}
        .ledger-banner{padding:16px;margin-bottom:14px}
        .ledger-banner-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:center}
        .ledger-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#8fa3b8);font-weight:700}
        .ledger-title{font-size:20px;font-weight:800;margin-top:5px}
        .ledger-sub{color:var(--muted,#8fa3b8);font-size:12px;margin-top:5px}
        .ledger-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .ledger-stat{padding:10px;border:1px solid var(--line,#1e2c3b);border-radius:8px;background:#0b131d}
        .ledger-stat strong{display:block;font:700 18px/1 ui-monospace,SFMono-Regular,Consolas,monospace}
        .ledger-stat span{display:block;color:var(--muted,#8fa3b8);font-size:10px;margin-top:5px;text-transform:uppercase}
        .ledger-funnel{margin-top:14px;border-top:1px solid var(--line,#1e2c3b);padding-top:12px}
        .ledger-funnel-label{font-size:10px;color:var(--muted,#8fa3b8);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
        .ledger-controls{padding:12px;margin-bottom:14px}
        .ledger-control-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr 1fr 1fr auto;gap:8px;align-items:end}
        .ledger-field label{display:block;color:var(--muted,#8fa3b8);font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
        .ledger-field input,.ledger-field select{width:100%;background:#0a1018;color:var(--text,#dbe4ee);border:1px solid var(--line,#1e2c3b);border-radius:7px;padding:8px 9px;font-size:12px;outline:none}
        .ledger-field input:focus,.ledger-field select:focus{border-color:var(--sky,#38bdf8)}
        .ledger-range-row{display:flex;gap:6px}
        .ledger-range-row input{min-width:0}
        .ledger-export{height:34px;border:1px solid var(--gold,#e3b23c);background:transparent;color:var(--gold,#e3b23c);border-radius:7px;padding:0 10px;font-weight:700;font-size:11px;cursor:pointer;white-space:nowrap}
        .ledger-export:hover{background:rgba(227,178,60,.08)}
        .ledger-results-head{display:flex;justify-content:space-between;align-items:center;margin:0 2px 8px}
        .ledger-count{font-size:11px;color:var(--muted,#8fa3b8)}
        .ledger-cards{display:grid;gap:9px}
        .ledger-card{padding:13px}
        .ledger-card-head{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start}
        .ledger-cluster{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:64px;min-height:50px;border:1px solid var(--line,#1e2c3b);border-radius:8px;background:#0b131d;padding:6px}
        .ledger-cluster strong{font:700 14px ui-monospace,SFMono-Regular,Consolas,monospace}
        .ledger-cluster span{font-size:9px;color:var(--muted,#8fa3b8);text-transform:uppercase}
        .ledger-card-title{font-weight:750;font-size:14px;line-height:1.35}
        .ledger-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
        .ledger-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line,#1e2c3b);border-radius:999px;padding:4px 7px;font-size:10px;color:var(--muted,#8fa3b8);background:#0b131d}
        .ledger-pill{border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;white-space:nowrap;border:1px solid transparent}
        .ledger-urgency-high{color:#fb7185;background:rgba(251,113,133,.09);border-color:rgba(251,113,133,.3)}
        .ledger-urgency-mid{color:#fbbf24;background:rgba(251,191,36,.09);border-color:rgba(251,191,36,.3)}
        .ledger-urgency-low{color:#34d399;background:rgba(52,211,153,.09);border-color:rgba(52,211,153,.3)}
        .ledger-positive{color:var(--ok,#34d399)}
        .ledger-negative{color:var(--bad,#fb7185)}
        .ledger-neutral{color:var(--muted,#8fa3b8)}
        .ledger-funded{color:var(--ok,#34d399);border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.07)}
        .ledger-partial{color:var(--warn,#fbbf24);border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.07)}
        .ledger-deferred{color:var(--bad,#fb7185);border-color:rgba(251,113,133,.3);background:rgba(251,113,133,.07)}
        .ledger-sla{justify-self:end}
        .ledger-breached{color:var(--bad,#fb7185);border-color:rgba(251,113,133,.4);background:rgba(251,113,133,.08)}
        .ledger-card-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:10px}
        .ledger-btn{border:1px solid var(--line,#1e2c3b);background:#0b131d;color:var(--text,#dbe4ee);border-radius:6px;padding:6px 9px;font-size:10px;cursor:pointer}
        .ledger-btn:hover{border-color:var(--sky,#38bdf8)}
        .ledger-btn.gold{border-color:var(--gold,#e3b23c);color:var(--gold,#e3b23c)}
        .ledger-details{margin-top:12px;border-top:1px solid var(--line,#1e2c3b);padding-top:10px}
        .ledger-report{border:1px solid var(--line,#1e2c3b);border-radius:8px;padding:9px;margin-top:7px;background:#0b131d}
        .ledger-report-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
        .ledger-report-text{font-size:11px;line-height:1.5;color:#c9d4df;margin-top:7px;white-space:pre-wrap}
        .ledger-report-name{font-size:10px;color:var(--muted,#8fa3b8)}
        .ledger-lang{font-size:9px;color:var(--sky,#38bdf8);border:1px solid rgba(56,189,248,.25);border-radius:999px;padding:3px 6px}
        .ledger-empty{padding:36px 20px;text-align:center}
        .ledger-empty-icon{font-size:28px;color:var(--muted,#8fa3b8);margin-bottom:8px}
        .ledger-empty strong{display:block;font-size:15px}
        .ledger-empty p{color:var(--muted,#8fa3b8);font-size:12px;max-width:520px;margin:7px auto 0;line-height:1.5}
        .ledger-merge{padding:13px;margin-top:14px}
        .ledger-merge-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
        .ledger-merge-title{font-size:13px;font-weight:800}
        .ledger-merge-sub{font-size:10px;color:var(--muted,#8fa3b8);margin-top:3px}
        .ledger-merge-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end;margin-top:10px}
        .ledger-merge select{width:100%;background:#0a1018;color:var(--text,#dbe4ee);border:1px solid var(--line,#1e2c3b);border-radius:7px;padding:8px;font-size:11px}
        .ledger-sim{margin-top:9px;padding:9px;border:1px dashed var(--line,#1e2c3b);border-radius:7px;display:flex;justify-content:space-between;gap:10px;align-items:center}
        .ledger-sim strong{font:700 16px ui-monospace,SFMono-Regular,Consolas,monospace}
        .ledger-help{font-size:10px;color:var(--muted,#8fa3b8);line-height:1.4}
        @media(max-width:900px){
          .ledger-control-grid{grid-template-columns:repeat(3,1fr)}
          .ledger-export{width:100%}
          .ledger-banner-grid{grid-template-columns:1fr}
        }
        @media(max-width:600px){
          .ledger-control-grid{grid-template-columns:1fr 1fr}
          .ledger-card-head{grid-template-columns:auto 1fr}
          .ledger-sla{grid-column:1/-1;justify-self:start}
          .ledger-stat-grid{grid-template-columns:1fr 1fr 1fr}
          .ledger-merge-grid{grid-template-columns:1fr}
        }
        @media(max-width:380px){
          .ledger-control-grid{grid-template-columns:1fr}
          .ledger-stat-grid{grid-template-columns:1fr}
        }
      </style>
    `;
  }

  function renderBanner(container, state) {
    const totalReports = (state.incidents || []).reduce(
      (sum, i) => sum + Number(i.clusterSize || 0),
      0
    );
    const masters = (state.incidents || []).length;
    const removed = totalReports
      ? Math.max(0, (1 - masters / totalReports) * 100)
      : 0;

    container.innerHTML = `
      <section class="ledger-panel ledger-banner">
        <div class="ledger-banner-grid">
          <div>
            <div class="ledger-kicker">Incident consolidation</div>
            <div class="ledger-title">Raw reports → master incidents</div>
            <div class="ledger-sub">
              AI-assisted clustering turns repeated citizen reports into actionable incident records.
            </div>
          </div>

          <div class="ledger-stat-grid">
            <div class="ledger-stat">
              <strong>${fmt(totalReports)}</strong>
              <span>Raw reports</span>
            </div>
            <div class="ledger-stat">
              <strong>${fmt(masters)}</strong>
              <span>Master incidents</span>
            </div>
            <div class="ledger-stat">
              <strong>${f1(removed)}%</strong>
              <span>Duplicates removed</span>
            </div>
          </div>
        </div>

        <div class="ledger-funnel">
          <div class="ledger-funnel-label">Consolidation funnel</div>
          <svg viewBox="0 0 760 72" width="100%" height="72" role="img" aria-label="Raw reports to master incidents funnel">
            <polygon points="0,8 410,8 350,64 60,64"
              fill="rgba(56,189,248,.10)"
              stroke="rgba(56,189,248,.5)" />
            <polygon points="430,18 760,18 720,54 470,54"
              fill="rgba(227,178,60,.10)"
              stroke="rgba(227,178,60,.55)" />
            <text x="205" y="42" text-anchor="middle" fill="#dbe4ee" font-size="13" font-family="ui-monospace,monospace">
              ${fmt(totalReports)} RAW REPORTS
            </text>
            <text x="595" y="42" text-anchor="middle" fill="#dbe4ee" font-size="13" font-family="ui-monospace,monospace">
              ${fmt(masters)} MASTER INCIDENTS
            </text>
          </svg>
        </div>
      </section>
    `;
  }

  function renderControls(container, state) {
    const categories = Array.isArray(CL.data.CATEGORIES) ? CL.data.CATEGORIES : [];
    const regions = Array.isArray(CL.data.REGIONS) ? CL.data.REGIONS : [];

    container.innerHTML = `
      <section class="ledger-panel ledger-controls">
        <div class="ledger-control-grid">
          <div class="ledger-field">
            <label for="ledger-search">Search</label>
            <input id="ledger-search" type="search" placeholder="Title, neighborhood, report text…">
          </div>

          <div class="ledger-field">
            <label for="ledger-region">Region</label>
            <select id="ledger-region">
              <option value="">All regions</option>
              ${regions.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}
            </select>
          </div>

          <div class="ledger-field">
            <label for="ledger-category">Category</label>
            <select id="ledger-category">
              <option value="">All categories</option>
              ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
            </select>
          </div>

          <div class="ledger-field">
            <label for="ledger-status">Funding</label>
            <select id="ledger-status">
              <option value="">All statuses</option>
              <option value="funded">Funded</option>
              <option value="partial">Partial</option>
              <option value="deferred">Deferred</option>
            </select>
          </div>

          <div class="ledger-field">
            <label>Urgency</label>
            <div class="ledger-range-row">
              <input id="ledger-min-urgency" type="number" min="1" max="10" value="1" aria-label="Minimum urgency">
              <input id="ledger-max-urgency" type="number" min="1" max="10" value="10" aria-label="Maximum urgency">
            </div>
          </div>

          <div class="ledger-field">
            <label for="ledger-sort">Sort</label>
            <select id="ledger-sort">
              <option value="priority">Priority</option>
              <option value="cluster">Cluster size</option>
              <option value="urgency">Urgency</option>
              <option value="sla">SLA</option>
            </select>
          </div>

          <button class="ledger-export" id="ledger-export" type="button">
            <i data-lucide="download"></i> CSV
          </button>
        </div>
      </section>
    `;

    container.querySelector("#ledger-export").addEventListener("click", () => {
      exportCsv(CL.store.get());
    });

    const rerender = CL.util.debounce(() => renderCards(state, container.parentElement), 80);

    ["#ledger-search", "#ledger-region", "#ledger-category", "#ledger-status", "#ledger-min-urgency", "#ledger-max-urgency", "#ledger-sort"]
      .forEach(selector => {
        const el = container.querySelector(selector);
        if (!el) return;
        el.addEventListener("input", rerender);
        el.addEventListener("change", rerender);
      });

    CL.util.icons();
  }

  function renderCards(state, root) {
    const cards = root.querySelector("#ledger-cards");
    const count = root.querySelector("#ledger-results-count");
    if (!cards || !count) return;

    const controls = getControls(root);
    const allocation = getAllocation(state);

    let incidents = (state.incidents || []).filter(i =>
      incidentMatches(i, controls, allocation)
    );

    incidents.sort((a, b) => {
      if (controls.sort === "cluster") {
        return Number(b.clusterSize || 0) - Number(a.clusterSize || 0);
      }

      if (controls.sort === "urgency") {
        return Number(b.urgency || 0) - Number(a.urgency || 0);
      }

      if (controls.sort === "sla") {
        const ad = slaInfo(a).timestamp || Infinity;
        const bd = slaInfo(b).timestamp || Infinity;
        return ad - bd;
      }

      return priority(b) - priority(a);
    });

    currentFiltered = incidents;

    count.textContent =
      incidents.length + " of " + (state.incidents || []).length + " master incidents";

    if (!incidents.length) {
      cards.innerHTML = `
        <section class="ledger-panel ledger-empty">
          <div class="ledger-empty-icon"><i data-lucide="search-x"></i></div>
          <strong>No incidents match the current filters.</strong>
          <p>
            Try clearing the search, widening the urgency range, or selecting
            "All" for region, category, and funding status.
          </p>
        </section>
      `;
      CL.util.icons();
      return;
    }

    cards.innerHTML = incidents.map(incident =>
      renderIncidentCard(incident, state, allocation)
    ).join("");

    bindCardEvents(cards, state);
    CL.util.icons();
  }

  function renderIncidentCard(incident, state, allocation) {
    const region = regionById(incident.regionId);
    const funding = statusFor(incident, allocation);
    const sla = slaInfo(incident);
    const isExpanded = expanded.has(incident.id);
    const reports = getReports(incident);
    const planId = state.plan && state.plan[incident.id];

    return `
      <article class="ledger-panel ledger-card" data-incident-id="${esc(incident.id)}">
        <div class="ledger-card-head">
          <div class="ledger-cluster" title="Cluster size">
            <strong>${fmt(incident.clusterSize || 0)}</strong>
            <span>reports</span>
          </div>

          <div>
            <div class="ledger-card-title">${esc(incident.title || "Untitled incident")}</div>
            <div class="ledger-meta">
              <span class="ledger-chip">
                <i data-lucide="map-pin"></i>
                ${esc(region.name)}
              </span>
              <span class="ledger-chip">${esc(region.country)}</span>
              <span class="ledger-chip">${esc(incident.neighborhood || "Unknown neighborhood")}</span>
              <span class="ledger-chip">${esc(incident.category || "Uncategorized")}</span>
              <span class="ledger-chip">
                ${f1(priority(incident))} priority
              </span>
            </div>
          </div>

          <div>
            <span class="ledger-pill ${urgencyClass(Number(incident.urgency || 0))}">
              AI URGENCY ${esc(incident.urgency || 0)}/10
            </span>
          </div>
        </div>

        <div class="ledger-meta" style="margin-top:10px">
          <span class="ledger-pill ${sentimentClass(incident.sentiment)}">
            ${esc(incident.sentiment || "Neutral")}
          </span>

          <span class="ledger-pill ${statusClass(funding.status)}">
            ${statusLabel(funding.status)} · ${Math.round((funding.pct || 0) * 100)}%
          </span>

          <span class="ledger-chip">
            $${f1(incident.estCost || 0)}M estimated
          </span>

          <span class="ledger-chip ledger-sla ${sla.breached ? "ledger-breached" : ""}">
            <i data-lucide="timer"></i>
            <span data-sla-deadline="${sla.timestamp || ""}">${esc(sla.text)}</span>
          </span>

          ${planId ? `
            <span class="ledger-chip">
              <i data-lucide="check-circle-2"></i>
              Blueprint deployed
            </span>
          ` : ""}
        </div>

        <div class="ledger-card-actions">
          <button class="ledger-btn" data-action="toggle" type="button">
            <i data-lucide="${isExpanded ? "chevron-up" : "chevron-down"}"></i>
            ${isExpanded ? "Hide reports" : "View reports"}
          </button>

          <button class="ledger-btn gold" data-action="split" type="button">
            <i data-lucide="split"></i>
            Split off
          </button>
        </div>

        ${isExpanded ? renderReports(incident, state) : ""}
      </article>
    `;
  }

  function renderReports(incident, state) {
    const reports = getReports(incident);

    if (!reports.length) {
      return `
        <div class="ledger-details">
          <div class="ledger-help">No sample micro-reports are attached to this master incident.</div>
        </div>
      `;
    }

    return `
      <div class="ledger-details">
        <div class="ledger-help">
          Showing up to 8 sampled micro-reports. PII is ${state.anonymize ? "masked" : "visible"} according to the current privacy setting.
        </div>

        ${reports.map((report, index) => {
          const mode = languageMode[report.id] || "original";
          const masked = maskedReport(report, state);
          const lang = masked.lang || report.lang || "en";
          const langDef = (CL.data.LANGUAGES || []).find(l => l.code === lang);
          const text = getReportText(report, state, mode);

          return `
            <div class="ledger-report">
              <div class="ledger-report-head">
                <div>
                  <span class="ledger-lang">${esc(langDef ? langDef.name : lang)}</span>
                  <span class="ledger-report-name">
                    ${esc(masked.name || "Anonymous reporter")}
                  </span>
                </div>

                <button
                  class="ledger-btn"
                  data-action="language"
                  data-report-id="${esc(report.id || (incident.id + "-" + index))}"
                  type="button">
                  ${mode === "original" ? "English" : "Original"}
                </button>
              </div>

              <div class="ledger-report-text">${esc(text)}</div>

              <div class="ledger-meta">
                ${masked.sentiment ? `<span class="ledger-chip">${esc(masked.sentiment)}</span>` : ""}
                ${masked.urgency != null ? `<span class="ledger-chip">Urgency ${esc(masked.urgency)}/10</span>` : ""}
                ${masked.ts ? `<span class="ledger-chip">${esc(new Date(masked.ts).toLocaleString())}</span>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function bindCardEvents(cards, state) {
    cards.querySelectorAll("[data-action='toggle']").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-incident-id]");
        const id = card && card.dataset.incidentId;
        if (!id) return;

        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);

        renderCards(CL.store.get(), cards.parentElement.parentElement);
      });
    });

    cards.querySelectorAll("[data-action='language']").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-incident-id]");
        const id = card && card.dataset.incidentId;
        const reportId = button.dataset.reportId;

        if (!id || !reportId) return;

        languageMode[reportId] =
          languageMode[reportId] === "english" ? "original" : "english";

        renderCards(CL.store.get(), cards.parentElement.parentElement);
      });
    });

    cards.querySelectorAll("[data-action='split']").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-incident-id]");
        if (!card) return;

        const incidentId = card.dataset.incidentId;
        splitIncident(incidentId);
      });
    });
  }

  function splitIncident(incidentId) {
    const state = CL.store.get();
    const incident = (state.incidents || []).find(i => i.id === incidentId);

    if (!incident) return;

    const reports = getReports(incident);

    if (!reports.length) {
      CL.ui.toast("This incident has no sampled micro-report to split.", "warn");
      return;
    }

    const report = reports[reports.length - 1];
    const newId = CL.util.uid("inc");

    CL.store.update(s => {
      const source = (s.incidents || []).find(i => i.id === incidentId);
      if (!source) return;

      source.clusterSize = Math.max(1, Number(source.clusterSize || 1) - 1);
      source.reports = (source.reports || []).filter(r => r.id !== report.id);

      const newIncident = {
        id: newId,
        regionId: source.regionId,
        title: "Split report: " + (report.englishText || report.originalText || "Citizen report").slice(0, 80),
        neighborhood: source.neighborhood,
        category: source.category,
        urgency: Number(report.urgency || source.urgency || 1),
        sentiment: report.sentiment || source.sentiment || "Neutral",
        estCost: Number(source.estCost || 0),
        clusterSize: 1,
        createdAt: report.ts || new Date().toISOString(),
        slaHours: source.slaHours,
        reports: [report]
      };

      s.incidents.push(newIncident);

      if (s.plan && s.plan[incidentId]) {
        delete s.plan[incidentId];
      }
    });

    if (CL.engines && CL.engines.appendAudit) {
      CL.engines.appendAudit(
        "incident.split",
        "Split micro-report " + report.id + " from incident " + incidentId + " into " + newId
      ).catch(() => {});
    }

    expanded.add(newId);
    CL.ui.toast("Micro-report split into a new master incident.", "success");
  }

  function buildMergeTool(root, state) {
    const host = root.querySelector("#ledger-merge");
    if (!host) return;

    const incidents = state.incidents || [];

    host.innerHTML = `
      <div class="ledger-merge-head">
        <div>
          <div class="ledger-merge-title">
            <i data-lucide="git-merge"></i> Merge preview
          </div>
          <div class="ledger-merge-sub">
            Select two master incidents from the same region and category.
          </div>
        </div>
      </div>

      <div class="ledger-merge-grid">
        <div class="ledger-field">
          <label for="ledger-merge-a">Incident A</label>
          <select id="ledger-merge-a">
            <option value="">Choose incident…</option>
            ${incidents.map(i => `
              <option value="${esc(i.id)}">
                ${esc(i.title || i.id)}
              </option>
            `).join("")}
          </select>
        </div>

        <div style="text-align:center;color:var(--muted,#8fa3b8);padding-bottom:8px">
          ↔
        </div>

        <div class="ledger-field">
          <label for="ledger-merge-b">Incident B</label>
          <select id="ledger-merge-b">
            <option value="">Choose incident…</option>
            ${incidents.map(i => `
              <option value="${esc(i.id)}">
                ${esc(i.title || i.id)}
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      <div id="ledger-merge-preview" class="ledger-sim">
        <div class="ledger-help">Choose two incidents to calculate token similarity.</div>
      </div>
    `;

    const a = host.querySelector("#ledger-merge-a");
    const b = host.querySelector("#ledger-merge-b");

    function updatePreview() {
      const ia = incidents.find(i => i.id === a.value);
      const ib = incidents.find(i => i.id === b.value);
      const preview = host.querySelector("#ledger-merge-preview");

      if (!ia || !ib) {
        preview.innerHTML = `
          <div class="ledger-help">Choose two incidents to calculate token similarity.</div>
        `;
        return;
      }

      const sameGroup =
        ia.regionId === ib.regionId &&
        ia.category === ib.category;

      const textA = [
        ia.title,
        ia.neighborhood,
        ...getReports(ia).map(r => r.englishText || r.originalText || "")
      ].filter(Boolean).join(" ");

      const textB = [
        ib.title,
        ib.neighborhood,
        ...getReports(ib).map(r => r.englishText || r.originalText || "")
      ].filter(Boolean).join(" ");

      let score = 0;
      try {
        score = CL.engines.similarity(textA, textB) || 0;
      } catch (e) {
        score = 0;
      }

      if (!sameGroup) {
        preview.innerHTML = `
          <div>
            <strong style="color:var(--bad,#fb7185)">Cannot merge</strong>
            <div class="ledger-help">Both incidents must have the same region and category.</div>
          </div>
          <span style="font:700 16px ui-monospace,monospace">${Math.round(score * 100)}%</span>
        `;
        return;
      }

      preview.innerHTML = `
        <div>
          <strong>${Math.round(score * 100)}% similarity</strong>
          <div class="ledger-help">
            Same region: yes · Same category: yes ·
            ${fmt(Number(ia.clusterSize || 0) + Number(ib.clusterSize || 0))} reports after merge
          </div>
        </div>

        <button
          id="ledger-merge-confirm"
          class="ledger-btn gold"
          type="button">
          <i data-lucide="git-merge"></i> Merge
        </button>
      `;

      const mergeButton = preview.querySelector("#ledger-merge-confirm");
      mergeButton.addEventListener("click", () => {
        mergeIncidents(a.value, b.value);
      });

      CL.util.icons();
    }

    a.addEventListener("change", updatePreview);
    b.addEventListener("change", updatePreview);
    CL.util.icons();
  }

  function mergeIncidents(idA, idB) {
    if (!idA || !idB || idA === idB) {
      CL.ui.toast("Select two different incidents.", "warn");
      return;
    }

    const state = CL.store.get();
    const a = (state.incidents || []).find(i => i.id === idA);
    const b = (state.incidents || []).find(i => i.id === idB);

    if (!a || !b) {
      CL.ui.toast("One of the selected incidents no longer exists.", "error");
      return;
    }

    if (a.regionId !== b.regionId || a.category !== b.category) {
      CL.ui.toast("Only incidents in the same region and category can be merged.", "warn");
      return;
    }

    const textA = [
      a.title,
      ...getReports(a).map(r => r.englishText || r.originalText || "")
    ].filter(Boolean).join(" ");

    const textB = [
      b.title,
      ...getReports(b).map(r => r.englishText || r.originalText || "")
    ].filter(Boolean).join(" ");

    let similarity = 0;
    try {
      similarity = CL.engines.similarity(textA, textB) || 0;
    } catch (e) {}

    CL.store.update(s => {
      const first = (s.incidents || []).find(i => i.id === idA);
      const secondIndex = (s.incidents || []).findIndex(i => i.id === idB);
      if (!first || secondIndex < 0) return;

      const second = s.incidents[secondIndex];

      first.clusterSize =
        Number(first.clusterSize || 0) +
        Number(second.clusterSize || 0);

      const combinedReports = [
        ...(first.reports || []),
        ...(second.reports || [])
      ];

      const seen = new Set();
      first.reports = combinedReports.filter(r => {
        const key = r.id || JSON.stringify(r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 8);

      first.urgency = Math.max(
        Number(first.urgency || 0),
        Number(second.urgency || 0)
      );

      first.estCost = Math.max(
        Number(first.estCost || 0),
        Number(second.estCost || 0)
      );

      if (first.sentiment !== second.sentiment) {
        first.sentiment = "Neutral";
      }

      if (s.plan && s.plan[idB]) {
        if (!s.plan[idA]) s.plan[idA] = s.plan[idB];
        delete s.plan[idB];
      }

      s.incidents.splice(secondIndex, 1);
    });

    if (CL.engines && CL.engines.appendAudit) {
      CL.engines.appendAudit(
        "incident.merge",
        "Merged " + idB + " into " + idA +
        " with similarity " + Math.round(similarity * 100) + "%"
      ).catch(() => {});
    }

    expanded.delete(idB);
    CL.ui.toast(
      "Incidents merged · " + Math.round(similarity * 100) + "% similarity.",
      "success"
    );
  }

  function refreshSla(root) {
    root.querySelectorAll("[data-sla-deadline]").forEach(el => {
      const deadline = Number(el.dataset.slaDeadline || 0);
      if (!deadline) return;

      const diff = deadline - Date.now();

      if (diff <= 0) {
        el.textContent = "BREACHED · " + formatDuration(Math.abs(diff));
        el.parentElement.classList.add("ledger-breached");
      } else {
        el.textContent = "SLA " + formatDuration(diff);
        el.parentElement.classList.remove("ledger-breached");
      }
    });
  }

  CL.registerView("ledger", {
    label: "Incident Ledger",
    icon: "layers",
    order: 2,

    mount: function (container) {
      let root = container;

      root.innerHTML = `
        ${buildStyles()}

        <div class="ledger-wrap">
          <div id="ledger-banner"></div>

          <div id="ledger-controls"></div>

          <div class="ledger-results-head">
            <div class="ledger-kicker">Master incident ledger</div>
            <div id="ledger-results-count" class="ledger-count"></div>
          </div>

          <div id="ledger-cards" class="ledger-cards"></div>

          <section id="ledger-merge" class="ledger-panel ledger-merge"></section>
        </div>
      `;

      function renderAll(state) {
        renderBanner(root.querySelector("#ledger-banner"), state);
        renderControls(root.querySelector("#ledger-controls"), state);
        renderCards(state, root);
        buildMergeTool(root, state);
        CL.util.icons();
      }

      renderAll(CL.store.get());

      cleanupState = CL.bus.on("state", function (state) {
        renderAll(state || CL.store.get());
      });

      timer = setInterval(function () {
        refreshSla(root);
      }, 30000);

      refreshSla(root);
      CL.util.icons();

      return function () {
        if (cleanupState) {
          cleanupState();
          cleanupState = null;
        }

        if (timer) {
          clearInterval(timer);
          timer = null;
        }

        expanded.clear();
      };
    }
  });
})();
