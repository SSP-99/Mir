// js/views/labs.js
(function () {
  const CL = window.CL = window.CL || {};

  let simTimer = null;
  let slaTimer = null;
  let sparklineHistory = [72, 74, 73, 76, 78, 81, 80, 84];

  function computeTrustIndex(state) {
    if (!state) return { score: 75, factors: [] };
    const incidents = state.incidents || [];
    const alloc = CL.engines && CL.engines.allocateBudget ? CL.engines.allocateBudget(state.budget) : { byId: {} };
    
    // SLA Met %
    const slaMetCount = incidents.filter(i => {
      const hrs = (Date.now() - new Date(i.createdAt).getTime()) / 3600000;
      return hrs <= (i.slaHours || 48);
    }).length;
    const slaMetPct = incidents.length ? (slaMetCount / incidents.length) * 100 : 100;

    // Report Merge Efficiency %
    let totalReports = 0;
    incidents.forEach(i => { totalReports += (i.reports ? i.reports.length : 1); });
    const mergedPct = totalReports > 0 ? ((totalReports - incidents.length) / totalReports) * 100 : 50;

    // Budget Funding %
    let fundedCount = 0;
    Object.values(alloc.byId || {}).forEach(a => {
      if (a.status === 'funded') fundedCount++;
    });
    const fundedPct = incidents.length ? (fundedCount / incidents.length) * 100 : 50;

    // Blueprint Deployment %
    const deployedCount = Object.keys(state.plan || {}).length;
    const blueprintPct = incidents.length ? Math.min(100, (deployedCount / incidents.length) * 100) : 0;

    const score = Math.min(100, Math.round(
      (slaMetPct * 0.35) +
      (mergedPct * 0.25) +
      (fundedPct * 0.25) +
      (blueprintPct * 0.15)
    ));

    const factors = [
      { name: 'SLA Compliance', value: Math.round(slaMetPct), weight: '35%' },
      { name: 'De-duplication / Cluster Rate', value: Math.round(mergedPct), weight: '25%' },
      { name: 'Infrastructure Budget Funded', value: Math.round(fundedPct), weight: '25%' },
      { name: 'Cross-Border Blueprint Adoption', value: Math.round(blueprintPct), weight: '15%' }
    ];

    return { score, factors };
  }

  CL.registerView('labs', {
    label: 'Live Ops',
    icon: 'radio',
    order: 5,
    mount: function (container) {
      let activeTab = 'sim'; // 'sim' | 'trust' | 'audit' | 'sla'
      let isSimRunning = false;
      let simSpeed = 4000;
      let liveFeedLogs = [];
      let corruptedChain = null;
      let auditResult = null;

      function render() {
        const state = CL.store ? CL.store.get() : {};
        const trust = computeTrustIndex(state);
        
        // Ensure score stays in sparkline history
        if (sparklineHistory[sparklineHistory.length - 1] !== trust.score) {
          sparklineHistory.push(trust.score);
          if (sparklineHistory.length > 12) sparklineHistory.shift();
        }

        container.innerHTML = `
          <div class="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-[var(--text)]">
            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <h1 class="text-2xl font-bold flex items-center gap-2">
                  <i data-lucide="radio" class="w-6 h-6 text-[var(--gold)]"></i>
                  Live Operations & Simulation Lab
                </h1>
                <p class="text-xs text-[var(--muted)] mt-1">Real-time citizen feed simulator, trust indices, cryptographic audit chains, and SLA breach monitors.</p>
              </div>
              
              <!-- Tab Navigation -->
              <div class="flex items-center bg-[var(--panel)] p-1 rounded-lg border border-[var(--line)] text-xs font-mono">
                <button id="tab-sim" class="px-3 py-1.5 rounded flex items-center gap-1.5 ${activeTab === 'sim' ? 'bg-[var(--gold)] text-black font-semibold' : 'hover:text-white'}">
                  <i data-lucide="activity" class="w-3.5 h-3.5"></i> Feed Simulator
                </button>
                <button id="tab-trust" class="px-3 py-1.5 rounded flex items-center gap-1.5 ${activeTab === 'trust' ? 'bg-[var(--gold)] text-black font-semibold' : 'hover:text-white'}">
                  <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Trust Index
                </button>
                <button id="tab-audit" class="px-3 py-1.5 rounded flex items-center gap-1.5 ${activeTab === 'audit' ? 'bg-[var(--gold)] text-black font-semibold' : 'hover:text-white'}">
                  <i data-lucide="file-check-2" class="w-3.5 h-3.5"></i> Audit Ledger
                </button>
                <button id="tab-sla" class="px-3 py-1.5 rounded flex items-center gap-1.5 ${activeTab === 'sla' ? 'bg-[var(--gold)] text-black font-semibold' : 'hover:text-white'}">
                  <i data-lucide="timer" class="w-3.5 h-3.5"></i> SLA Watchtower
                </button>
              </div>
            </div>

            <!-- Tab 1: Live Citizen Feed Simulator -->
            <div id="panel-sim" class="${activeTab === 'sim' ? 'block' : 'hidden'} space-y-4">
              <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <button id="btn-toggle-sim" class="px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 ${isSimRunning ? 'bg-[var(--bad)] text-white' : 'bg-[var(--ok)] text-black'}">
                    <i data-lucide="${isSimRunning ? 'square' : 'play'}" class="w-4 h-4"></i>
                    ${isSimRunning ? 'Stop Simulation' : 'Start Simulation'}
                  </button>
                  
                  <div class="flex items-center gap-2 border-l border-[var(--line)] pl-3 text-xs font-mono">
                    <span class="text-[var(--muted)]">Speed:</span>
                    <select id="sim-speed-select" class="bg-[var(--bg)] border border-[var(--line)] rounded px-2 py-1 text-xs text-[var(--text)]">
                      <option value="2000" ${simSpeed === 2000 ? 'selected' : ''}>2s Fast</option>
                      <option value="4000" ${simSpeed === 4000 ? 'selected' : ''}>4s Normal</option>
                      <option value="7000" ${simSpeed === 7000 ? 'selected' : ''}>7s Slow</option>
                    </select>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button id="btn-surge" class="px-3 py-2 bg-[var(--warn)] text-black rounded-lg font-bold text-xs flex items-center gap-1.5 hover:brightness-110">
                    <i data-lucide="zap" class="w-4 h-4"></i>
                    Inject Surge (20 Reports)
                  </button>
                </div>
              </div>

              <!-- Scrolling Live Feed Container -->
              <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4">
                <div class="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-3">
                  <h3 class="text-sm font-semibold flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${isSimRunning ? 'bg-[var(--ok)] animate-ping' : 'bg-[var(--muted)]'}"></span>
                    Live Ingestion Stream
                  </h3>
                  <span class="text-xs font-mono text-[var(--muted)]">${liveFeedLogs.length} Events Processed</span>
                </div>

                <div id="feed-stream" class="space-y-2 max-h-[450px] overflow-y-auto pr-2 font-mono text-xs">
                  ${liveFeedLogs.length === 0 ? `
                    <div class="text-center py-12 text-[var(--muted)]">
                      <i data-lucide="radio" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
                      Simulator idle. Click "Start Simulation" or "Inject Surge" to ingest real-time multilingual reports.
                    </div>
                  ` : liveFeedLogs.map(log => `
                    <div class="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 border-l-4 ${log.merged ? 'border-l-[var(--sky)]' : 'border-l-[var(--gold)]'}">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${log.merged ? 'bg-[var(--sky)]/20 text-[var(--sky)]' : 'bg-[var(--gold)]/20 text-[var(--gold)]'}">
                            ${log.merged ? 'Merged into Existing' : 'New Incident Created'}
                          </span>
                          <span class="text-[var(--muted)]">[${log.time}]</span>
                          <span class="font-bold text-white">${CL.util ? CL.util.esc(log.regionName) : log.regionName}</span>
                          <span class="text-[var(--muted)]">(${log.langName})</span>
                        </div>
                        <p class="text-[var(--text)] italic">"${CL.util ? CL.util.esc(log.originalText) : log.originalText}"</p>
                        <p class="text-[var(--muted)] text-[11px]">→ Translation: ${CL.util ? CL.util.esc(log.englishText) : log.englishText}</p>
                      </div>
                      <div class="text-right flex md:flex-col items-center md:items-end justify-between gap-1 border-t md:border-t-0 border-[var(--line)] pt-2 md:pt-0">
                        <span class="px-2 py-0.5 rounded text-[10px] bg-[var(--panel)] border border-[var(--line)]">${log.category}</span>
                        <span class="text-[10px] text-[var(--warn)]">Urgency: ${log.urgency}/10</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Tab 2: Citizen Trust Index -->
            <div id="panel-trust" class="${activeTab === 'trust' ? 'block' : 'hidden'} space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Trust Gauge -->
                <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-6 flex flex-col items-center justify-center text-center">
                  <h3 class="text-xs uppercase font-mono tracking-wider text-[var(--muted)] mb-4">Citizen Trust Score</h3>
                  <div class="relative w-36 h-36 flex items-center justify-center rounded-full border-4 border-[var(--line)] bg-[var(--bg)]">
                    <div class="text-center">
                      <span class="text-4xl font-extrabold font-mono text-[var(--gold)]">${trust.score}</span>
                      <span class="text-xs text-[var(--muted)] block">/ 100</span>
                    </div>
                  </div>
                  <p class="text-xs text-[var(--muted)] mt-4 max-w-xs">Aggregated index measuring platform transparency, SLA adherence, and budget fulfillment.</p>
                </div>

                <!-- Sparkline Trend -->
                <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 class="text-xs uppercase font-mono tracking-wider text-[var(--muted)] mb-1">Trust Score Trend</h3>
                    <p class="text-xs text-[var(--muted)]">Historical memory tracker (Last 12 snapshots)</p>
                  </div>
                  
                  <div class="h-28 flex items-end gap-2 pt-4 border-b border-[var(--line)] pb-2">
                    ${sparklineHistory.map((val, idx) => {
                      const hPct = Math.max(10, Math.min(100, val));
                      return `
                        <div class="flex-1 bg-[var(--bg)] rounded-t relative group flex flex-col items-center justify-end h-full">
                          <div style="height: ${hPct}%" class="w-full bg-[var(--gold)] rounded-t opacity-80 group-hover:opacity-100 transition-all"></div>
                          <span class="absolute -top-6 text-[10px] font-mono bg-[var(--panel)] border border-[var(--line)] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">${val}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <div class="flex justify-between text-[10px] font-mono text-[var(--muted)] pt-2">
                    <span>Previous Cycles</span>
                    <span>Current</span>
                  </div>
                </div>

                <!-- Factors Breakdown -->
                <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-6 space-y-4">
                  <h3 class="text-xs uppercase font-mono tracking-wider text-[var(--muted)]">Core Factor Breakdown</h3>
                  <div class="space-y-3 font-mono text-xs">
                    ${trust.factors.map(f => `
                      <div>
                        <div class="flex justify-between text-[11px] mb-1">
                          <span class="text-[var(--text)]">${f.name} (${f.weight})</span>
                          <span class="font-bold text-[var(--gold)]">${f.value}%</span>
                        </div>
                        <div class="w-full bg-[var(--bg)] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                          <div style="width: ${f.value}%" class="h-full bg-[var(--gold)] rounded-full"></div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab 3: Audit Ledger & Tamper Simulation -->
            <div id="panel-audit" class="${activeTab === 'audit' ? 'block' : 'hidden'} space-y-4">
              <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 class="text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="lock" class="w-4 h-4 text-[var(--gold)]"></i>
                    SHA-256 Cryptographic Audit Trail
                  </h3>
                  <p class="text-xs text-[var(--muted)]">Every state modification generates an immutable linked hash node.</p>
                </div>

                <div class="flex items-center gap-2">
                  <button id="btn-verify-audit" class="px-3 py-1.5 bg-[var(--sky)] text-black font-semibold rounded text-xs flex items-center gap-1.5 hover:brightness-110">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                    Verify Chain
                  </button>
                  <button id="btn-tamper-audit" class="px-3 py-1.5 bg-[var(--bad)] text-white font-semibold rounded text-xs flex items-center gap-1.5 hover:brightness-110">
                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
                    Simulate Tampering
                  </button>
                  ${corruptedChain ? `
                    <button id="btn-restore-audit" class="px-3 py-1.5 bg-[var(--ok)] text-black font-semibold rounded text-xs flex items-center gap-1.5 hover:brightness-110">
                      <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                      Restore Integrity
                    </button>
                  ` : ''}
                </div>
              </div>

              ${auditResult ? `
                <div class="p-3 rounded-lg border font-mono text-xs flex items-center justify-between ${auditResult.ok ? 'bg-[var(--ok)]/10 border-[var(--ok)] text-[var(--ok)]' : 'bg-[var(--bad)]/10 border-[var(--bad)] text-[var(--bad)]'}">
                  <div class="flex items-center gap-2">
                    <i data-lucide="${auditResult.ok ? 'check-circle' : 'x-circle'}" class="w-4 h-4"></i>
                    <span>${auditResult.ok ? 'Cryptographic Chain Verified: All blocks are untampered and signatures align.' : `Chain Validation Failed: Corrupted state hash detected at block index ${auditResult.brokenAt}!`}</span>
                  </div>
                </div>
              ` : ''}

              <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr class="bg-[var(--bg)] border-b border-[var(--line)] text-[var(--muted)] uppercase text-[10px]">
                      <th class="p-3">Index</th>
                      <th class="p-3">Timestamp</th>
                      <th class="p-3">Type</th>
                      <th class="p-3">Message</th>
                      <th class="p-3">Previous Hash</th>
                      <th class="p-3">Current Hash</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--line)]">
                    ${((corruptedChain || state.audit) || []).map((entry, idx) => {
                      const isCorruptedRow = auditResult && !auditResult.ok && auditResult.brokenAt === idx;
                      return `
                        <tr class="${isCorruptedRow ? 'bg-[var(--bad)]/20 text-[var(--bad)] font-bold' : 'hover:bg-[var(--bg)]/50'}">
                          <td class="p-3 text-[var(--muted)]">#${idx}</td>
                          <td class="p-3 whitespace-nowrap">${new Date(entry.ts).toLocaleTimeString()}</td>
                          <td class="p-3"><span class="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] uppercase text-[10px]">${CL.util ? CL.util.esc(entry.type) : entry.type}</span></td>
                          <td class="p-3 max-w-xs truncate">${CL.util ? CL.util.esc(entry.msg) : entry.msg}</td>
                          <td class="p-3 font-mono text-[10px] text-[var(--muted)] truncate max-w-[100px]">${entry.prevHash ? entry.prevHash.substring(0, 10) + '...' : 'GENESIS'}</td>
                          <td class="p-3 font-mono text-[10px] text-[var(--gold)] truncate max-w-[100px]">${entry.hash ? entry.hash.substring(0, 10) + '...' : 'NONE'}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 4: SLA Watchtower -->
            <div id="panel-sla" class="${activeTab === 'sla' ? 'block' : 'hidden'} space-y-4">
              <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold flex items-center gap-2">
                    <i data-lucide="clock" class="w-4 h-4 text-[var(--warn)]"></i>
                    SLA Breach & Resolution Countdown
                  </h3>
                  <p class="text-xs text-[var(--muted)]">Incidents prioritized by urgency nearing or exceeding required response limits.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="sla-cards-container">
                <!-- Rendered dynamically by updateSLACountdowns() -->
              </div>
            </div>
          </div>
        `;

        if (CL.util && CL.util.icons) CL.util.icons();
        attachEvents();
        updateSLACountdowns();
      }

      function updateSLACountdowns() {
        const slaContainer = container.querySelector('#sla-cards-container');
        if (!slaContainer || activeTab !== 'sla') return;

        const state = CL.store ? CL.store.get() : {};
        const incidents = (state.incidents || []).map(inc => {
          const created = new Date(inc.createdAt).getTime();
          const slaMs = (inc.slaHours || 48) * 3600000;
          const deadline = created + slaMs;
          const remainingMs = deadline - Date.now();
          return { ...inc, remainingMs };
        }).sort((a, b) => a.remainingMs - b.remainingMs);

        if (incidents.length === 0) {
          slaContainer.innerHTML = `<div class="col-span-2 text-center py-8 text-[var(--muted)] text-xs">No active incidents found in SLA watchtower.</div>`;
          return;
        }

        slaContainer.innerHTML = incidents.map(inc => {
          const isBreached = inc.remainingMs <= 0;
          const absMs = Math.abs(inc.remainingMs);
          const hours = Math.floor(absMs / 3600000);
          const mins = Math.floor((absMs % 3600000) / 60000);
          const secs = Math.floor((absMs % 60000) / 1000);
          const timeStr = `${hours}h ${mins}m ${secs}s`;

          return `
            <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 space-y-3 relative overflow-hidden">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase ${isBreached ? 'bg-[var(--bad)]/20 text-[var(--bad)] border border-[var(--bad)]' : 'bg-[var(--warn)]/20 text-[var(--warn)] border border-[var(--warn)]'}">
                  ${isBreached ? 'SLA Breached' : 'Active Countdown'}
                </span>
                <span class="text-xs font-mono font-bold ${isBreached ? 'text-[var(--bad)]' : 'text-[var(--warn)]'}">
                  ${isBreached ? `+${timeStr} overdue` : `${timeStr} remaining`}
                </span>
              </div>

              <div>
                <h4 class="text-sm font-bold text-white">${CL.util ? CL.util.esc(inc.title) : inc.title}</h4>
                <p class="text-xs text-[var(--muted)]">${CL.util ? CL.util.esc(inc.neighborhood) : inc.neighborhood} • ${inc.category}</p>
              </div>

              <div class="flex items-center justify-between text-xs font-mono pt-2 border-t border-[var(--line)]">
                <span class="text-[var(--muted)]">Urgency: <strong class="text-white">${inc.urgency}/10</strong></span>
                <span class="text-[var(--muted)]">Cluster: <strong class="text-white">${inc.clusterSize} reports</strong></span>
              </div>
            </div>
          `;
        }).join('');
      }

      function generateAndIngestRandomReport() {
        if (!CL.data || !CL.engines) return;
        const languages = CL.data.LANGUAGES || [];
        const regions = CL.data.REGIONS || [];
        if (!languages.length || !regions.length) return;

        const langObj = languages[Math.floor(Math.random() * languages.length)];
        const regObj = regions[Math.floor(Math.random() * regions.length)];

        const payload = {
          text: langObj.sample || 'Need urgent assistance with municipal infrastructure.',
          langHint: langObj.code
        };

        CL.engines.analyzeReport(payload).then(analysis => {
          const ingResult = CL.engines.ingestReport({
            regionId: regObj.id,
            name: 'Simulated Citizen',
            phone: '+1555000999',
            lang: langObj.code,
            text: payload.text,
            analysis
          });

          const logEntry = {
            time: new Date().toLocaleTimeString(),
            regionName: regObj.name,
            langName: langObj.name,
            originalText: payload.text,
            englishText: analysis.english || payload.text,
            category: analysis.category || 'Water',
            urgency: analysis.urgency || 5,
            merged: ingResult ? ingResult.merged : false
          };

          liveFeedLogs.unshift(logEntry);
          if (liveFeedLogs.length > 50) liveFeedLogs.pop();

          if (activeTab === 'sim') {
            const streamEl = container.querySelector('#feed-stream');
            if (streamEl) {
              render();
            }
          }
        });
      }

      function injectSurge() {
        if (!CL.ui) return;
        CL.ui.toast('Injecting 20 surge reports...', 'warn');
        let count = 0;
        const surgeInterval = setInterval(() => {
          generateAndIngestRandomReport();
          count++;
          if (count >= 20) {
            clearInterval(surgeInterval);
            if (CL.ui) CL.ui.toast('Surge injection completed.', 'success');
          }
        }, 150);
      }

      function attachEvents() {
        // Tab Switches
        const btnSim = container.querySelector('#tab-sim');
        const btnTrust = container.querySelector('#tab-trust');
        const btnAudit = container.querySelector('#tab-audit');
        const btnSLA = container.querySelector('#tab-sla');

        if (btnSim) btnSim.onclick = () => { activeTab = 'sim'; render(); };
        if (btnTrust) btnTrust.onclick = () => { activeTab = 'trust'; render(); };
        if (btnAudit) btnAudit.onclick = () => { activeTab = 'audit'; render(); };
        if (btnSLA) btnSLA.onclick = () => { activeTab = 'sla'; render(); };

        // Simulation toggle
        const btnToggleSim = container.querySelector('#btn-toggle-sim');
        if (btnToggleSim) {
          btnToggleSim.onclick = () => {
            isSimRunning = !isSimRunning;
            if (isSimRunning) {
              simTimer = setInterval(generateAndIngestRandomReport, simSpeed);
              if (CL.ui) CL.ui.toast('Live feed simulator started', 'info');
            } else {
              if (simTimer) clearInterval(simTimer);
              simTimer = null;
              if (CL.ui) CL.ui.toast('Live feed simulator paused', 'info');
            }
            render();
          };
        }

        // Speed select
        const speedSelect = container.querySelector('#sim-speed-select');
        if (speedSelect) {
          speedSelect.onchange = (e) => {
            simSpeed = parseInt(e.target.value, 10);
            if (isSimRunning) {
              clearInterval(simTimer);
              simTimer = setInterval(generateAndIngestRandomReport, simSpeed);
            }
          };
        }

        // Surge
        const btnSurge = container.querySelector('#btn-surge');
        if (btnSurge) btnSurge.onclick = injectSurge;

        // Verify Audit
        const btnVerify = container.querySelector('#btn-verify-audit');
        if (btnVerify) {
          btnVerify.onclick = () => {
            if (corruptedChain) {
              // verify manually against corrupted copy
              let brokenAt = null;
              for (let i = 0; i < corruptedChain.length; i++) {
                const item = corruptedChain[i];
                const expectedPrev = i === 0 ? '' : corruptedChain[i - 1].hash;
                if (item.prevHash !== expectedPrev) {
                  brokenAt = i;
                  break;
                }
              }
              auditResult = { ok: brokenAt === null, brokenAt };
              render();
            } else if (CL.engines && CL.engines.verifyAudit) {
              CL.engines.verifyAudit().then(res => {
                auditResult = res;
                render();
              });
            }
          };
        }

        // Tamper Audit
        const btnTamper = container.querySelector('#btn-tamper-audit');
        if (btnTamper) {
          btnTamper.onclick = () => {
            const state = CL.store ? CL.store.get() : {};
            const auditCopy = JSON.parse(JSON.stringify(state.audit || []));
            if (auditCopy.length > 0) {
              const targetIdx = Math.floor(auditCopy.length / 2);
              auditCopy[targetIdx].msg = '[TAMPERED] Unverified state modification injection';
              auditCopy[targetIdx].hash = '00000000000000000000000000000000';
              corruptedChain = auditCopy;
              auditResult = null;
              if (CL.ui) CL.ui.toast('Injected corruption into temporary chain copy', 'error');
              render();
            }
          };
        }

        // Restore Audit
        const btnRestore = container.querySelector('#btn-restore-audit');
        if (btnRestore) {
          btnRestore.onclick = () => {
            corruptedChain = null;
            auditResult = null;
            if (CL.ui) CL.ui.toast('Audit chain integrity restored', 'success');
            render();
          };
        }
      }

      // SLA Countdown interval timer
      slaTimer = setInterval(updateSLACountdowns, 1000);

      // Initial render
      render();

      // State subscription
      const unsub = CL.bus ? CL.bus.on('state', () => {
        if (activeTab === 'trust' || activeTab === 'sla' || activeTab === 'audit') {
          render();
        }
      }) : null;

      // Cleanup
      return function () {
        if (simTimer) clearInterval(simTimer);
        if (slaTimer) clearInterval(slaTimer);
        if (unsub) unsub();
      };
    }
  });
})();
