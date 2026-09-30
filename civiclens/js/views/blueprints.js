// js/views/blueprints.js
(function(){
  const CL = window.CL = window.CL || {};

  const VIEW_ID = 'blueprints';

  function regionById(id){
    return (CL.data.REGIONS || []).find(r => r.id === id);
  }

  function blueprintById(id){
    return (CL.data.BLUEPRINTS || []).find(b => b.id === id);
  }

  function priority(incident){
    const region = regionById(incident.regionId);
    return region ? CL.engines.priorityScore(incident, region) : 0;
  }

  function selectedIncident(state){
    let incident = (state.incidents || []).find(i => i.id === state.selectedIssueId);
    if (incident) return incident;

    return (state.incidents || [])
      .slice()
      .sort((a,b) => priority(b) - priority(a))[0] || null;
  }

  function normalizeAlternative(item){
    if (!item) return null;

    if (typeof item === 'string') {
      return blueprintById(item) || null;
    }

    if (item.id) {
      return blueprintById(item.id) || item;
    }

    return null;
  }

  function money(n){
    return '$' + CL.util.f1(Number(n || 0)) + 'M';
  }

  function esc(value){
    return CL.util.esc(value == null ? '' : String(value));
  }

  function countryCode(country){
    const region = (CL.data.REGIONS || []).find(r => r.country === country);
    return region ? region.cc : String(country || '').slice(0,3).toUpperCase();
  }

  function render(container){
    const state = CL.store.get();
    let incident = selectedIncident(state);

    if (!incident) {
      container.innerHTML = `
        <div class="min-h-[420px] flex items-center justify-center">
          <div class="text-center">
            <div class="text-slate-300 text-lg font-semibold">No incidents available</div>
            <div class="text-slate-500 text-sm mt-2">Blueprint recommendations will appear when citizen reports are available.</div>
          </div>
        </div>
      `;
      CL.util.icons();
      return;
    }

    if (!state.selectedIssueId || !state.incidents.some(i => i.id === state.selectedIssueId)) {
      CL.store.update(s => {
        s.selectedIssueId = incident.id;
      });
      return;
    }

    const region = regionById(incident.regionId);
    const match = CL.engines.matchBlueprint(incident) || {};
    const blueprint = match.blueprint || null;
    const plan = state.plan || {};
    const deployedId = plan[incident.id] || null;
    const deployedBlueprint = deployedId ? blueprintById(deployedId) : null;

    const activeBlueprint = deployedBlueprint || blueprint;
    const previewSaving = Number(activeBlueprint && activeBlueprint.savingPct || 0);
    const beforeCost = Number(incident.estCost || 0);
    const afterCost = beforeCost * (1 - previewSaving);
    const savingAmount = beforeCost - afterCost;

    const alternatives = (match.alternatives || [])
      .map(normalizeAlternative)
      .filter(Boolean)
      .filter(b => !activeBlueprint || b.id !== activeBlueprint.id);

    const incidentsByRegion = {};
    (state.incidents || []).forEach(item => {
      if (!incidentsByRegion[item.regionId]) incidentsByRegion[item.regionId] = [];
      incidentsByRegion[item.regionId].push(item);
    });

    Object.keys(incidentsByRegion).forEach(id => {
      incidentsByRegion[id].sort((a,b) => priority(b) - priority(a));
    });

    const regions = (CL.data.REGIONS || []).filter(r => incidentsByRegion[r.id]);

    const deployedRows = [];
    let totalRegionalSavings = 0;

    regions.forEach(r => {
      const items = incidentsByRegion[r.id]
        .map(item => {
          const bid = plan[item.id];
          const bp = bid ? blueprintById(bid) : null;
          if (!bp) return null;

          const saving = Number(item.estCost || 0) * Number(bp.savingPct || 0);
          return { incident:item, blueprint:bp, saving };
        })
        .filter(Boolean);

      if (items.length) {
        const total = items.reduce((sum,x) => sum + x.saving, 0);
        totalRegionalSavings += total;
        deployedRows.push({ region:r, items, total });
      }
    });

    const countries = Array.from(new Set(
      (CL.data.REGIONS || []).map(r => r.country)
    ));

    const matrix = {};
    countries.forEach(source => {
      matrix[source] = {};
      countries.forEach(target => {
        matrix[source][target] = 0;
      });
    });

    (state.incidents || []).forEach(item => {
      const bid = plan[item.id];
      const bp = bid ? blueprintById(bid) : null;
      const target = regionById(item.regionId);

      if (bp && target && bp.country) {
        if (!matrix[bp.country]) matrix[bp.country] = {};
        if (matrix[bp.country][target.country] == null) {
          matrix[bp.country][target.country] = 0;
        }
        matrix[bp.country][target.country]++;
      }
    });

    const maxMatrix = Math.max(
      1,
      ...countries.flatMap(source => countries.map(target => matrix[source][target] || 0))
    );

    function heatStyle(value){
      if (!value) {
        return 'background:rgba(30,44,59,.28);';
      }
      const alpha = Math.min(.82, .18 + (value / maxMatrix) * .64);
      return `background:rgba(56,189,248,${alpha});color:#06111b;`;
    }

    function issueRow(item){
      const r = regionById(item.regionId);
      const isSelected = item.id === incident.id;
      const score = priority(item);
      const deployed = !!plan[item.id];

      return `
        <button
          type="button"
          data-issue-id="${esc(item.id)}"
          class="w-full text-left p-3 border rounded-lg transition-all ${
            isSelected
              ? 'border-sky-400/70 bg-sky-400/10'
              : 'border-slate-800 bg-slate-950/30 hover:border-slate-600'
          }">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs text-slate-500 font-mono">${esc(r ? r.name : 'Unknown region')}</div>
              <div class="text-sm text-slate-200 font-medium mt-1 truncate">${esc(item.title)}</div>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              item.urgency >= 7
                ? 'border-rose-400/40 text-rose-300'
                : 'border-amber-400/30 text-amber-300'
            }">P${CL.util.f1(score)}</span>
          </div>
          <div class="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span>${esc(item.category)}</span>
            <span>•</span>
            <span>${esc(item.neighborhood || 'Regional')}</span>
            ${deployed ? '<span class="ml-auto text-emerald-300">DEPLOYED</span>' : ''}
          </div>
        </button>
      `;
    }

    const regionGroups = regions.map(r => `
      <div class="mb-5">
        <div class="flex items-center justify-between mb-2 px-1">
          <div>
            <div class="text-xs uppercase tracking-widest text-slate-500">${esc(r.country)}</div>
            <div class="text-sm text-slate-300 font-semibold">${esc(r.name)}</div>
          </div>
          <span class="text-[10px] font-mono text-slate-600">${incidentsByRegion[r.id].length} ISSUE${incidentsByRegion[r.id].length === 1 ? '' : 'S'}</span>
        </div>
        <div class="space-y-2">
          ${incidentsByRegion[r.id].map(issueRow).join('')}
        </div>
      </div>
    `).join('');

    const reasonItems = (match.reasons || []).map(reason => `
      <li class="flex gap-2 text-sm text-slate-300">
        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"></i>
        <span>${esc(reason)}</span>
      </li>
    `).join('');

    const ringPct = Math.max(0, Math.min(100, Number(match.matchPct || 0)));
    const circumference = 2 * Math.PI * 44;
    const ringOffset = circumference * (1 - ringPct / 100);

    const sourceCountry = activeBlueprint ? activeBlueprint.country : '—';
    const targetCountry = region ? region.country : '—';

    const regionalPlansHtml = deployedRows.length
      ? deployedRows.map(group => `
        <div class="border border-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3 bg-slate-950/50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-semibold text-slate-200">${esc(group.region.name)}</div>
              <div class="text-xs text-slate-500">${esc(group.region.country)}</div>
            </div>
            <div class="text-xs font-mono text-emerald-300">
              TOTAL SAVINGS ${money(group.total)}
            </div>
          </div>
          <div class="divide-y divide-slate-800">
            ${group.items.map(x => `
              <div class="px-4 py-3 flex flex-wrap items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-slate-300 truncate">${esc(x.blueprint.title)}</div>
                  <div class="text-[11px] text-slate-500">${esc(x.incident.title)} · ${esc(x.blueprint.country)} → ${esc(group.region.country)}</div>
                </div>
                <div class="text-xs font-mono text-emerald-300">-${money(x.saving)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
      : `
        <div class="border border-dashed border-slate-800 rounded-xl p-8 text-center">
          <div class="text-slate-400 text-sm">No blueprints deployed yet.</div>
          <div class="text-slate-600 text-xs mt-1">Deploy a cross-border blueprint to create a regional action plan.</div>
        </div>
      `;

    const matrixHtml = `
      <div class="overflow-x-auto">
        <div class="min-w-[760px]">
          <div
            class="grid gap-1"
            style="grid-template-columns:150px repeat(${countries.length}, minmax(72px,1fr));">
            <div class="p-2 text-[10px] uppercase tracking-widest text-slate-600">SOURCE ↓ / TARGET →</div>
            ${countries.map(c => `
              <div class="p-2 text-[10px] font-semibold text-slate-500 text-center truncate" title="${esc(c)}">
                ${esc(countryCode(c))}
              </div>
            `).join('')}

            ${countries.map(source => `
              <div class="p-2 text-[11px] text-slate-400 font-medium truncate" title="${esc(source)}">
                ${esc(source)}
              </div>
              ${countries.map(target => {
                const value = matrix[source][target] || 0;
                return `
                  <div
                    class="min-h-[46px] rounded-md border border-slate-900 flex items-center justify-center text-xs font-mono transition-transform hover:scale-[1.03]"
                    style="${heatStyle(value)}"
                    title="${esc(source)} → ${esc(target)}: ${value} deployment${value === 1 ? '' : 's'}">
                    ${value || '·'}
                  </div>
                `;
              }).join('')}
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = `
      <style>
        @keyframes clBlueprintFlow {
          0% { stroke-dashoffset: 90; opacity: .25; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: .25; }
        }
        @keyframes clBlueprintPulse {
          0%,100% { transform: scale(.96); opacity:.65; }
          50% { transform: scale(1.04); opacity:1; }
        }
        .cl-blueprint-flow {
          stroke-dasharray: 7 7;
          animation: clBlueprintFlow 2.2s linear infinite;
        }
        .cl-blueprint-node {
          transform-box: fill-box;
          transform-origin: center;
          animation: clBlueprintPulse 2.4s ease-in-out infinite;
        }
      </style>

      <div class="space-y-5 pb-8">

        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div class="text-[11px] uppercase tracking-[.22em] text-sky-400 font-semibold">CROSS-BORDER KNOWLEDGE TRANSFER</div>
            <h1 class="text-2xl font-semibold text-slate-100 mt-1">Blueprint Matrix</h1>
            <p class="text-sm text-slate-500 mt-1">Reusable infrastructure solutions matched to citizen-priority hotspots.</p>
          </div>
          <div class="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            DIGITAL PUBLIC GOOD NETWORK
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-5">

          <aside class="border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-800">
              <div class="flex items-center justify-between">
                <span class="text-xs uppercase tracking-widest text-slate-400 font-semibold">Priority Issues</span>
                <span class="text-[10px] text-slate-600 font-mono">${state.incidents.length} TOTAL</span>
              </div>
            </div>
            <div class="p-3 max-h-[700px] overflow-y-auto">
              ${regionGroups || '<div class="text-sm text-slate-500 p-3">No issues found.</div>'}
            </div>
          </aside>

          <main class="border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden">

            <div class="p-5 border-b border-slate-800">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[10px] font-mono uppercase tracking-widest text-sky-400 border border-sky-400/20 px-2 py-1 rounded">
                      ${esc(incident.category)}
                    </span>
                    <span class="text-[10px] font-mono text-slate-500">${esc(incident.id)}</span>
                    ${deployedId ? '<span class="text-[10px] font-mono text-emerald-300 border border-emerald-400/20 px-2 py-1 rounded">DEPLOYED</span>' : ''}
                  </div>
                  <h2 class="text-xl font-semibold text-slate-100 mt-3">${esc(incident.title)}</h2>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                    <span><i data-lucide="map-pin" class="inline w-3.5 h-3.5 mr-1"></i>${esc(region ? region.name : 'Unknown')}</span>
                    <span>${esc(incident.neighborhood || 'Regional')}</span>
                    <span>${CL.util.fmt(incident.clusterSize || 0)} micro-reports</span>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-[10px] uppercase tracking-widest text-slate-600">Priority</div>
                  <div class="text-2xl font-mono text-amber-300 mt-1">${CL.util.f1(priority(incident))}</div>
                </div>
              </div>
            </div>

            ${activeBlueprint ? `
              <div class="p-5 border-b border-slate-800">
                <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-4">

                  <div class="relative h-[145px] overflow-hidden rounded-lg bg-[#0a1018] border border-slate-900 mb-5">
                    <svg viewBox="0 0 800 145" class="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="clBlueprintGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stop-color="#e3b23c"></stop>
                          <stop offset="100%" stop-color="#38bdf8"></stop>
                        </linearGradient>
                      </defs>
                      <path d="M145 72 C285 15, 505 130, 655 72"
                            fill="none"
                            stroke="#1e2c3b"
                            stroke-width="5"></path>
                      <path d="M145 72 C285 15, 505 130, 655 72"
                            fill="none"
                            stroke="url(#clBlueprintGradient)"
                            stroke-width="2"
                            class="cl-blueprint-flow"></path>

                      <circle cx="145" cy="72" r="24" fill="#0f1823" stroke="#e3b23c" stroke-width="2" class="cl-blueprint-node"></circle>
                      <circle cx="655" cy="72" r="24" fill="#0f1823" stroke="#38bdf8" stroke-width="2" class="cl-blueprint-node"></circle>

                      <text x="145" y="77" text-anchor="middle" font-size="12" fill="#e3b23c">${esc(countryCode(sourceCountry))}</text>
                      <text x="655" y="77" text-anchor="middle" font-size="12" fill="#38bdf8">${esc(region ? region.cc : countryCode(targetCountry))}</text>
                    </svg>

                    <div class="absolute left-4 top-3 text-[9px] uppercase tracking-widest text-slate-600">SOURCE NATION</div>
                    <div class="absolute right-4 top-3 text-[9px] uppercase tracking-widest text-slate-600">TARGET REGION</div>

                    <div class="absolute left-4 bottom-3 text-xs text-slate-300 font-medium">${esc(sourceCountry)}</div>
                    <div class="absolute right-4 bottom-3 text-xs text-slate-300 font-medium text-right">${esc(region ? region.name : targetCountry)}</div>
                  </div>

                  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_125px] gap-5">
                    <div>
                      <div class="text-[10px] uppercase tracking-widest text-slate-500">Recommended Blueprint</div>
                      <h3 class="text-xl font-semibold text-slate-100 mt-1">${esc(activeBlueprint.title)}</h3>
                      <p class="text-sm leading-6 text-slate-400 mt-3">${esc(activeBlueprint.summary)}</p>

                      <div class="flex flex-wrap gap-2 mt-4">
                        ${(activeBlueprint.tags || []).map(tag => `
                          <span class="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                            #${esc(tag)}
                          </span>
                        `).join('')}
                      </div>
                    </div>

                    <div class="flex justify-center lg:justify-end">
                      <div class="relative w-[112px] h-[112px]">
                        <svg viewBox="0 0 112 112" class="w-full h-full -rotate-90">
                          <circle cx="56" cy="56" r="44" fill="none" stroke="#1e2c3b" stroke-width="8"></circle>
                          <circle cx="56" cy="56" r="44" fill="none" stroke="#38bdf8" stroke-width="8"
                            stroke-linecap="round"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${ringOffset}"></circle>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                          <div class="text-xl font-mono text-slate-100">${CL.util.f1(ringPct)}%</div>
                          <div class="text-[9px] uppercase tracking-widest text-slate-600">MATCH</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-800">
                <div class="p-4 border-r border-slate-800">
                  <div class="text-[10px] uppercase tracking-widest text-slate-600">Cost Saving</div>
                  <div class="text-xl font-mono text-emerald-300 mt-1">${CL.util.f1(previewSaving * 100)}%</div>
                </div>
                <div class="p-4 lg:border-r border-slate-800">
                  <div class="text-[10px] uppercase tracking-widest text-slate-600">Deployment</div>
                  <div class="text-xl font-mono text-slate-200 mt-1">${esc(activeBlueprint.weeks)} <span class="text-xs text-slate-500">weeks</span></div>
                </div>
                <div class="p-4 border-r border-slate-800 border-t lg:border-t-0">
                  <div class="text-[10px] uppercase tracking-widest text-slate-600">Before</div>
                  <div class="text-xl font-mono text-slate-300 mt-1">${money(beforeCost)}</div>
                </div>
                <div class="p-4 border-t lg:border-t-0">
                  <div class="text-[10px] uppercase tracking-widest text-slate-600">After</div>
                  <div class="text-xl font-mono text-emerald-300 mt-1">${money(afterCost)}</div>
                </div>
              </div>

              <div class="p-5 border-b border-slate-800">
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)] gap-6">
                  <div>
                    <div class="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Why this match</div>
                    <ul class="space-y-2">
                      ${reasonItems || `
                        <li class="text-sm text-slate-500">No matching rationale was returned.</li>
                      `}
                    </ul>
                  </div>

                  <div class="rounded-lg border border-emerald-400/10 bg-emerald-400/5 p-4">
                    <div class="text-[10px] uppercase tracking-widest text-slate-600">Projected Economic Effect</div>
                    <div class="text-2xl font-mono text-emerald-300 mt-2">${money(savingAmount)}</div>
                    <div class="text-xs text-slate-500 mt-1">estimated reduction from current project cost</div>
                  </div>
                </div>
              </div>

              <div class="p-5 border-b border-slate-800">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Alternative Blueprints</div>
                    <div class="text-xs text-slate-600 mt-1">Select an alternative to preview its impact.</div>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  ${alternatives.length ? alternatives.map(alt => `
                    <button
                      type="button"
                      data-alt-id="${esc(alt.id)}"
                      class="text-left rounded-lg border border-slate-800 bg-slate-950/40 hover:border-sky-400/40 p-4 transition">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-sm font-semibold text-slate-300">${esc(alt.title)}</div>
                          <div class="text-[11px] text-slate-500 mt-1">${esc(alt.country)}</div>
                        </div>
                        <span class="text-xs font-mono text-emerald-300">${CL.util.f1(Number(alt.savingPct || 0) * 100)}%</span>
                      </div>
                      <div class="text-xs text-slate-500 mt-3 line-clamp-2">${esc(alt.summary)}</div>
                    </button>
                  `).join('') : `
                    <div class="text-sm text-slate-600">No alternatives returned for this incident.</div>
                  `}
                </div>
              </div>

              <div class="p-5 bg-slate-950/20">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div class="text-xs text-slate-500">Digital Public Good transfer</div>
                    <div class="text-sm text-slate-300 mt-1">
                      ${esc(sourceCountry)} → ${esc(region ? region.name : targetCountry)}
                      <span class="text-slate-600">·</span>
                      ${money(savingAmount)} projected savings
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    ${deployedId ? `
                      <button
                        type="button"
                        id="undo-blueprint"
                        class="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm">
                        Undo
                      </button>
                      <button
                        type="button"
                        disabled
                        class="px-4 py-2 rounded-lg bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-sm font-semibold cursor-default">
                        <i data-lucide="check" class="inline w-4 h-4 mr-1"></i>Deployed
                      </button>
                    ` : `
                      <button
                        type="button"
                        id="deploy-blueprint"
                        class="px-4 py-2.5 rounded-lg bg-[#e3b23c] text-[#0a1018] hover:bg-[#f0c34e] text-sm font-bold shadow-lg shadow-amber-500/10">
                        <i data-lucide="rocket" class="inline w-4 h-4 mr-1"></i>
                        Deploy Blueprint as Digital Public Good
                      </button>
                    `}
                  </div>
                </div>
              </div>

            ` : `
              <div class="p-8 text-center">
                <div class="text-slate-300 font-semibold">No blueprint available</div>
                <div class="text-sm text-slate-500 mt-2">The matching engine did not return a blueprint for this incident.</div>
              </div>
            `}
          </main>
        </div>

        <section class="border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-[10px] uppercase tracking-widest text-emerald-400">EXECUTION LAYER</div>
              <h2 class="text-lg font-semibold text-slate-200 mt-1">Regional Action Plans</h2>
            </div>
            <div class="text-xs font-mono text-slate-500">
              NETWORK SAVINGS <span class="text-emerald-300">${money(totalRegionalSavings)}</span>
            </div>
          </div>
          <div class="p-5 space-y-3">
            ${regionalPlansHtml}
          </div>
        </section>

        <section class="border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-800">
            <div class="text-[10px] uppercase tracking-widest text-sky-400">COLLABORATION GRAPH</div>
            <h2 class="text-lg font-semibold text-slate-200 mt-1">Cross-Border Collaboration Matrix</h2>
            <p class="text-xs text-slate-500 mt-1">Blueprint deployments by source country and target country.</p>
          </div>
          <div class="p-5">
            ${matrixHtml}
          </div>
        </section>

      </div>
    `;

    CL.util.icons();

    const issueButtons = container.querySelectorAll('[data-issue-id]');
    issueButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-issue-id');
        CL.store.update(s => {
          s.selectedIssueId = id;
        });
      });
    });

    const altButtons = container.querySelectorAll('[data-alt-id]');
    altButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-alt-id');
        const alt = blueprintById(id);
        if (!alt) return;

        const preview = {
          blueprint: alt,
          matchPct: alt.matchBase || 0,
          reasons: [
            'alternative cross-border blueprint',
            'same infrastructure category',
            'reusable implementation pattern'
          ],
          alternatives: alternatives.filter(x => x.id !== alt.id)
        };

        container.__clBlueprintPreview = preview;

        const original = CL.engines.matchBlueprint;
        CL.engines.matchBlueprint = function(){
          return preview;
        };

        render(container);

        CL.engines.matchBlueprint = original;
      });
    });

    const deployBtn = container.querySelector('#deploy-blueprint');
    if (deployBtn && activeBlueprint) {
      deployBtn.addEventListener('click', () => {
        CL.engines.deployBlueprint(incident.id, activeBlueprint.id);
        CL.ui.toast('Blueprint deployed as a Digital Public Good.', 'success');
      });
    }

    const undoBtn = container.querySelector('#undo-blueprint');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        CL.store.update(s => {
          if (s.plan) delete s.plan[incident.id];
        });
        CL.ui.toast('Blueprint deployment undone.', 'warn');
      });
    }
  }

  CL.registerView(VIEW_ID, {
    label: 'Blueprint Matrix',
    icon: 'network',
    order: 3,
    mount: function(container){
      let rendering = false;

      const draw = () => {
        if (rendering) return;
        rendering = true;
        try {
          render(container);
        } finally {
          rendering = false;
        }
      };

      const off = CL.bus.on('state', draw);
      draw();

      return function(){
        if (typeof off === 'function') off();
      };
    }
  });

})();
