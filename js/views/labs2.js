/* js/views/labs2.js */
(function() {
  const CL = window.CL = window.CL || {};

  // Track palette open state
  let isPaletteOpen = false;
  let paletteEl = null;

  // Track scenario state locally
  let budgetA = 90;
  let budgetB = 120;

  function renderLabs2View(container) {
    // Sync default budgetA to store budget if available
    const currentState = CL.store ? CL.store.get() : {};
    if (currentState.budget) {
      budgetA = currentState.budget;
    }

    function render() {
      const state = CL.store ? CL.store.get() : {};
      const incidents = state.incidents || [];
      const plans = state.plan || {};

      // Local budget allocation helper to compute without mutating store
      const allocA = simulateAllocation(incidents, plans, budgetA);
      const allocB = simulateAllocation(incidents, plans, budgetB);

      // Diff calculations
      const diffIncidents = incidents.map(inc => {
        const resA = allocA.byId[inc.id] || { status: 'deferred', pct: 0, funded: 0, cost: inc.estCost };
        const resB = allocB.byId[inc.id] || { status: 'deferred', pct: 0, funded: 0, cost: inc.estCost };
        return {
          incident: inc,
          statusA: resA.status,
          statusB: resB.status,
          fundedA: resA.funded,
          fundedB: resB.funded,
          changed: resA.status !== resB.status || Math.abs(resA.funded - resB.funded) > 0.01
        };
      }).filter(item => item.changed);

      // Marginal impact curve points ($10M increments from $10M to $200M)
      const curvePoints = [];
      for (let b = 10; b <= 200; b += 10) {
        const alloc = simulateAllocation(incidents, plans, b);
        curvePoints.push({ budget: b, impacted: alloc.citizensImpacted });
      }

      const maxImpact = Math.max(...curvePoints.map(p => p.impacted), 1);
      const svgWidth = 600;
      const svgHeight = 160;
      const padding = 20;

      const polylinePoints = curvePoints.map((p, idx) => {
        const x = padding + (idx / (curvePoints.length - 1)) * (svgWidth - padding * 2);
        const y = svgHeight - padding - (p.impacted / maxImpact) * (svgHeight - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      // Current A and B marker dots on SVG
      const markerAX = padding + ((budgetA - 10) / 190) * (svgWidth - padding * 2);
      const markerAY = svgHeight - padding - (allocA.citizensImpacted / maxImpact) * (svgHeight - padding * 2);
      const markerBX = padding + ((budgetB - 10) / 190) * (svgWidth - padding * 2);
      const markerBY = svgHeight - padding - (allocB.citizensImpacted / maxImpact) * (svgHeight - padding * 2);

      const html = `
        <div class="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-[var(--text)]">
          <!-- Top Header & Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <h1 class="text-xl md:text-2xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2">
                <i data-lucide="git-compare" class="w-6 h-6 text-[var(--gold)]"></i>
                Scenario Planning & Decision Support
              </h1>
              <p class="text-xs md:text-sm text-[var(--muted)] mt-1">
                Simulate budget allocations, analyze marginal impact curves, and configure platform parameters.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button id="btn-theme-toggle" class="px-3 py-1.5 rounded bg-[var(--panel)] border border-[var(--line)] text-xs font-medium hover:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)] flex items-center gap-1.5">
                <i data-lucide="sun-moon" class="w-4 h-4 text-[var(--gold)]"></i>
                Toggle Contrast
              </button>
              <button id="btn-kbd-help" class="px-3 py-1.5 rounded bg-[var(--panel)] border border-[var(--line)] text-xs font-medium hover:border-[var(--sky)] focus:outline-none focus:ring-2 focus:ring-[var(--sky)] flex items-center gap-1.5" aria-label="Keyboard Shortcuts">
                <i data-lucide="help-circle" class="w-4 h-4 text-[var(--sky)]"></i>
                Shortcuts (<kbd class="font-mono text-[10px] bg-[var(--bg)] px-1 rounded border border-[var(--line)]">?</kbd>)
              </button>
              <button id="btn-reset-data" class="px-3 py-1.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-medium hover:bg-rose-900/50 focus:outline-none focus:ring-2 focus:ring-rose-500 flex items-center gap-1.5">
                <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                Reset Demo Data
              </button>
            </div>
          </div>

          <!-- A/B Comparison Sliders and Cards -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Scenario A -->
            <div class="p-5 rounded-lg bg-[var(--panel)] border border-[var(--line)] space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-[var(--sky)] inline-block"></span>
                  <h2 class="font-semibold text-base text-[var(--text)]">Scenario A (Baseline)</h2>
                </div>
                <button id="btn-apply-a" class="px-2.5 py-1 rounded bg-[var(--sky)]/10 text-[var(--sky)] border border-[var(--sky)]/30 text-xs font-semibold hover:bg-[var(--sky)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--sky)]">
                  Apply A to Live
                </button>
              </div>

              <div class="space-y-2">
                <div class="flex justify-between items-center text-xs font-mono">
                  <label for="input-budget-a" class="text-[var(--muted)]">Budget Allocation:</label>
                  <span class="text-base font-bold text-[var(--sky)]">$${CL.util ? CL.util.fmt(budgetA) : budgetA}M</span>
                </div>
                <input id="input-budget-a" type="range" min="10" max="200" step="5" value="${budgetA}"
                  class="w-full accent-[var(--sky)] bg-[var(--bg)] rounded cursor-pointer" aria-label="Scenario A Budget Slider" />
              </div>

              <div class="grid grid-cols-3 gap-2 pt-2 text-center text-xs font-mono">
                <div class="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[var(--muted)] text-[10px] uppercase">Funded / Part</div>
                  <div class="font-bold text-[var(--ok)] text-sm mt-0.5">${allocA.fundedCount} / ${allocA.partialCount}</div>
                </div>
                <div class="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[var(--muted)] text-[10px] uppercase">Deferred</div>
                  <div class="font-bold text-[var(--bad)] text-sm mt-0.5">${allocA.deferredCount}</div>
                </div>
                <div class="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[var(--muted)] text-[10px] uppercase">Citizens Impacted</div>
                  <div class="font-bold text-[var(--sky)] text-sm mt-0.5">${CL.util ? CL.util.fmt(allocA.citizensImpacted) : allocA.citizensImpacted}</div>
                </div>
              </div>
            </div>

            <!-- Scenario B -->
            <div class="p-5 rounded-lg bg-[var(--panel)] border border-[var(--line)] space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-[var(--gold)] inline-block"></span>
                  <h2 class="font-semibold text-base text-[var(--text)]">Scenario B (Alternative)</h2>
                </div>
                <button id="btn-apply-b" class="px-2.5 py-1 rounded bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30 text-xs font-semibold hover:bg-[var(--gold)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]">
                  Apply B to Live
                </button>
              </div>

              <div class="space-y-2">
                <div class="flex justify-between items-center text-xs font-mono">
                  <label for="input-budget-b" class="text-[var(--muted)]">Budget Allocation:</label>
                  <span class="text-base font-bold text-[var(--gold)]">$${CL.util ? CL.util.fmt(budgetB) : budgetB}M</span>
                </div>
                <input id="input-budget-b" type="range" min="10" max="200" step="5" value="${budgetB}"
                  class="w-full accent-[var(--gold)] bg-[var(--bg)] rounded cursor-pointer" aria-label="Scenario B Budget Slider" />
              </div>

              <div class="grid grid-cols-3 gap-2 pt-2 text-center text-xs font-mono">
                <div class="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[var(--muted)] text-[10px] uppercase">Funded / Part</div>
                  <div class="font-bold text-[var(--ok)] text-sm mt-0.5">${allocB.fundedCount} / ${allocB.partialCount}</div>
                </div>
                <div class="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[var(--muted)] text-[10px] uppercase">Deferred</div>
                  <div class="font-bold text-[var(--bad)] text-sm mt-0.5">${allocB.deferredCount}</div>
                </div>
                <div class="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[var(--muted)] text-[10px] uppercase">Citizens Impacted</div>
                  <div class="font-bold text-[var(--gold)] text-sm mt-0.5">${CL.util ? CL.util.fmt(allocB.citizensImpacted) : allocB.citizensImpacted}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Marginal Impact Curve Chart -->
          <div class="p-5 rounded-lg bg-[var(--panel)] border border-[var(--line)] space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 class="font-semibold text-sm text-[var(--text)] flex items-center gap-2">
                  <i data-lucide="trending-up" class="w-4 h-4 text-[var(--gold)]"></i>
                  Marginal Value of Capital Curve ("Value of Extra $10M")
                </h3>
                <p class="text-xs text-[var(--muted)]">
                  Simulated citizen reach (Y-axis) across budget envelopes from $10M to $200M (X-axis).
                </p>
              </div>
              <div class="flex items-center gap-4 text-xs font-mono">
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[var(--sky)]"></span> Scenario A ($${budgetA}M)</span>
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[var(--gold)]"></span> Scenario B ($${budgetB}M)</span>
              </div>
            </div>

            <div class="w-full overflow-x-auto pt-2">
              <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full h-auto max-h-48 overflow-visible font-mono text-[10px]">
                <!-- Grid Lines -->
                <line x1="${padding}" y1="${padding}" x2="${svgWidth - padding}" y2="${padding}" stroke="var(--line)" stroke-dasharray="3,3" />
                <line x1="${padding}" y1="${svgHeight / 2}" x2="${svgWidth - padding}" y2="${svgHeight / 2}" stroke="var(--line)" stroke-dasharray="3,3" />
                <line x1="${padding}" y1="${svgHeight - padding}" x2="${svgWidth - padding}" y2="${svgHeight - padding}" stroke="var(--line)" />

                <!-- Curve Line -->
                <polyline fill="none" stroke="var(--sky)" stroke-width="2.5" opacity="0.8" points="${polylinePoints}" />

                <!-- Marker A -->
                <circle cx="${markerAX}" cy="${markerAY}" r="5" fill="var(--sky)" stroke="var(--panel)" stroke-width="2" />
                <!-- Marker B -->
                <circle cx="${markerBX}" cy="${markerBY}" r="5" fill="var(--gold)" stroke="var(--panel)" stroke-width="2" />

                <!-- Axis Labels -->
                <text x="${padding}" y="${svgHeight - 4}" fill="var(--muted)">$10M</text>
                <text x="${svgWidth / 2}" y="${svgHeight - 4}" fill="var(--muted)" text-anchor="middle">$105M</text>
                <text x="${svgWidth - padding}" y="${svgHeight - 4}" fill="var(--muted)" text-anchor="end">$200M</text>
              </svg>
            </div>
          </div>

          <!-- Scenario Status Variance / Diff Table -->
          <div class="p-5 rounded-lg bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-sm text-[var(--text)] flex items-center gap-2">
                <i data-lucide="layers" class="w-4 h-4 text-[var(--sky)]"></i>
                Status Delta Table (${diffIncidents.length} Differential Items)
              </h3>
              <span class="text-xs text-[var(--muted)] font-mono">Comparing Scenario A vs B</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr class="border-b border-[var(--line)] text-[var(--muted)] uppercase text-[10px]">
                    <th class="py-2 px-3">Incident / Category</th>
                    <th class="py-2 px-3">Est. Cost</th>
                    <th class="py-2 px-3">Status A ($${budgetA}M)</th>
                    <th class="py-2 px-3">Status B ($${budgetB}M)</th>
                    <th class="py-2 px-3 text-right">Delta ($M)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--line)]">
                  ${diffIncidents.length === 0 ? `
                    <tr>
                      <td colspan="5" class="py-6 text-center text-[var(--muted)] italic">
                        No status or funding changes between Scenario A and Scenario B.
                      </td>
                    </tr>
                  ` : diffIncidents.map(item => {
                    const inc = item.incident;
                    const delta = item.fundedB - item.fundedA;
                    const badgeClass = (st) => {
                      if (st === 'funded') return 'bg-emerald-950/60 text-[var(--ok)] border-emerald-800/50';
                      if (st === 'partial') return 'bg-amber-950/60 text-[var(--warn)] border-amber-800/50';
                      return 'bg-rose-950/60 text-[var(--bad)] border-rose-800/50';
                    };

                    return `
                      <tr class="hover:bg-[var(--bg)]/50 transition-colors">
                        <td class="py-2.5 px-3">
                          <div class="font-sans font-medium text-[var(--text)]">${CL.util ? CL.util.esc(inc.title) : inc.title}</div>
                          <div class="text-[10px] text-[var(--muted)]">${inc.category} • ${inc.neighborhood \vert{}\vert{} 'Region'}</div>                         </td>                         <td class="py-2.5 px-3 text-[var(--text)]">$${inc.estCost}M</td>
                        <td class="py-2.5 px-3">
                          <span class="px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${badgeClass(item.statusA)}">
                            ${item.statusA} ($${CL.util ? CL.util.f1(item.fundedA) : item.fundedA}M)
                          </span>
                        </td>
                        <td class="py-2.5 px-3">
                          <span class="px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${badgeClass(item.statusB)}">
                            ${item.statusB} ($${CL.util ? CL.util.f1(item.fundedB) : item.fundedB}M)
                          </span>
                        </td>
                        <td class="py-2.5 px-3 text-right font-bold ${delta >= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}">
                          ${delta >= 0 ? '+' : ''}$${CL.util ? CL.util.f1(delta) : delta}M
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Render only sub-containers or full innerHTML cleanly
      container.innerHTML = html;

      if (CL.util && typeof CL.util.icons === 'function') {
        CL.util.icons();
      }

      // Attach event listeners
      const sliderA = container.querySelector('#input-budget-a');
      const sliderB = container.querySelector('#input-budget-b');

      if (sliderA) {
        sliderA.addEventListener('input', (e) => {
          budgetA = Number(e.target.value);
          render();
        });
      }

      if (sliderB) {
        sliderB.addEventListener('input', (e) => {
          budgetB = Number(e.target.value);
          render();
        });
      }

      const btnApplyA = container.querySelector('#btn-apply-a');
      if (btnApplyA) {
        btnApplyA.addEventListener('click', () => {
          if (CL.store) {
            CL.store.update(s => { s.budget = budgetA; });
            if (CL.ui && typeof CL.ui.toast === 'function') {
              CL.ui.toast(`Live budget updated to Scenario A ($${budgetA}M)`, 'success');
            }
          }
        });
      }

      const btnApplyB = container.querySelector('#btn-apply-b');
      if (btnApplyB) {
        btnApplyB.addEventListener('click', () => {
          if (CL.store) {
            CL.store.update(s => { s.budget = budgetB; });
            if (CL.ui && typeof CL.ui.toast === 'function') {
              CL.ui.toast(`Live budget updated to Scenario B ($${budgetB}M)`, 'success');
            }
          }
        });
      }

      const btnTheme = container.querySelector('#btn-theme-toggle');
      if (btnTheme) {
        btnTheme.addEventListener('click', toggleTheme);
      }

      const btnKbdHelp = container.querySelector('#btn-kbd-help');
      if (btnKbdHelp) {
        btnKbdHelp.addEventListener('click', showKeyboardShortcutsModal);
      }

      const btnReset = container.querySelector('#btn-reset-data');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (confirm('Are you sure you want to reset all demo data and restore initial state?')) {
            if (CL.store && typeof CL.store.reset === 'function') {
              CL.store.reset();
              if (CL.ui && typeof CL.ui.toast === 'function') {
                CL.ui.toast('Demo data reset to seed default', 'info');
              }
            }
          }
        });
      }
    }

    render();

    // Subscribe to state changes
    let unsubscribe = null;
    if (CL.bus && typeof CL.bus.on === 'function') {
      unsubscribe = CL.bus.on('state', () => {
        render();
      });
    }

    return function cleanup() {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }

  // Local helper for allocation calculation
  function simulateAllocation(incidents, plans, targetBudget) {
    const regionMap = {};
    if (CL.data && CL.data.REGIONS) {
      CL.data.REGIONS.forEach(r => { regionMap[r.id] = r; });
    }

    // Sort incidents by priority score desc
    const sorted = [...incidents].map(inc => {
      const reg = regionMap[inc.regionId] || { density: 10, idi: 50 };
      const priority = (CL.engines && typeof CL.engines.priorityScore === 'function')
        ? CL.engines.priorityScore(inc, reg)
        : (inc.urgency * reg.density) / reg.idi;

      // Effective cost with blueprint
      let effCost = inc.estCost || 1;
      const deployedBpId = plans[inc.id];
      if (deployedBpId && CL.data && CL.data.BLUEPRINTS) {
        const bp = CL.data.BLUEPRINTS.find(b => b.id === deployedBpId);
        if (bp && bp.savingPct) {
          effCost = inc.estCost * (1 - bp.savingPct);
        }
      }

      return { ...inc, priorityScore: priority, effCost };
    }).sort((a, b) => b.priorityScore - a.priorityScore);

    let rem = targetBudget;
    const byId = {};
    let fundedCount = 0;
    let partialCount = 0;
    let deferredCount = 0;
    let citizensImpacted = 0;

    sorted.forEach(inc => {
      const cost = inc.effCost;
      if (rem >= cost && cost > 0) {
        byId[inc.id] = { status: 'funded', pct: 1.0, funded: cost, cost };
        rem -= cost;
        fundedCount++;
        citizensImpacted += (inc.clusterSize || 1) * 1200 * 1.0;
      } else if (rem > 0 && cost > 0) {
        const pct = rem / cost;
        byId[inc.id] = { status: 'partial', pct, funded: rem, cost };
        citizensImpacted += (inc.clusterSize || 1) * 1200 * pct;
        rem = 0;
        partialCount++;
      } else {
        byId[inc.id] = { status: 'deferred', pct: 0, funded: 0, cost };
        deferredCount++;
      }
    });

    return {
      byId,
      used: targetBudget - rem,
      remaining: rem,
      fundedCount,
      partialCount,
      deferredCount,
      citizensImpacted: Math.round(citizensImpacted)
    };
  }

  // UI Theme Toggle (dark / high-contrast)
  function toggleTheme() {
    const htmlEl = document.documentElement;
    const isHighContrast = htmlEl.classList.contains('high-contrast');
    if (isHighContrast) {
      htmlEl.classList.remove('high-contrast');
      localStorage.setItem('civiclens.theme', 'dark');
      if (CL.ui && typeof CL.ui.toast === 'function') {
        CL.ui.toast('Theme set to Standard Dark', 'info');
      }
    } else {
      htmlEl.classList.add('high-contrast');
      localStorage.setItem('civiclens.theme', 'high-contrast');
      if (CL.ui && typeof CL.ui.toast === 'function') {
        CL.ui.toast('Theme set to High Contrast', 'info');
      }
    }
  }

  // Restore saved theme on load
  const savedTheme = localStorage.getItem('civiclens.theme');
  if (savedTheme === 'high-contrast') {
    document.documentElement.classList.add('high-contrast');
  }

  // Keyboard Shortcuts Modal Help
  function showKeyboardShortcutsModal() {
    if (CL.ui && typeof CL.ui.open === 'function') {
      CL.ui.open('brief', {
        title: 'Keyboard Shortcuts',
        content: `
          <div class="space-y-4 font-mono text-xs text-[var(--text)]">
            <div class="grid grid-cols-2 gap-2 border-b border-[var(--line)] pb-2">
              <span class="text-[var(--gold)] font-bold">Ctrl + K / Cmd + K</span>
              <span class="text-[var(--muted)]">Open Command Palette</span>
            </div>
            <div class="grid grid-cols-2 gap-2 border-b border-[var(--line)] pb-2">
              <span class="text-[var(--gold)] font-bold">?</span>
              <span class="text-[var(--muted)]">Show Shortcuts Dialog</span>
            </div>
            <div class="grid grid-cols-2 gap-2 border-b border-[var(--line)] pb-2">
              <span class="text-[var(--gold)] font-bold">Esc</span>
              <span class="text-[var(--muted)]">Close Overlays / Palette</span>
            </div>
            <div class="grid grid-cols-2 gap-2 border-b border-[var(--line)] pb-2">
              <span class="text-[var(--gold)] font-bold">budget [number]</span>
              <span class="text-[var(--muted)]">Command: Set budget (e.g., budget 120)</span>
            </div>
          </div>
        `
      });
    } else {
      alert('Keyboard Shortcuts:\n- Ctrl+K / Cmd+K: Open Command Palette\n- ?: Show Keyboard Help\n- Esc: Close Dialogs');
    }
  }

  // Command Palette (Ctrl/Cmd + K) Injection & Logic
  function initCommandPalette() {
    if (document.getElementById('cl-command-palette')) return;

    paletteEl = document.createElement('div');
    paletteEl.id = 'cl-command-palette';
    paletteEl.className = 'fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm hidden';
    paletteEl.innerHTML = `
      <div class="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden text-[var(--text)] mx-4">
        <div class="flex items-center px-4 border-b border-[var(--line)]">
          <i data-lucide="search" class="w-5 h-5 text-[var(--muted)] mr-2"></i>
          <input id="cl-palette-input" type="text" placeholder="Search commands, tabs, incidents, or type 'budget 120'..."
            class="w-full py-3.5 bg-transparent text-sm focus:outline-none text-[var(--text)] placeholder-[var(--muted)]" aria-label="Command Palette Search Input" />
          <kbd class="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--muted)] bg-[var(--bg)]">ESC</kbd>
        </div>
        <div id="cl-palette-results" class="max-h-80 overflow-y-auto p-2 space-y-1 font-sans text-xs">
          <!-- Dynamically populated results -->
        </div>
      </div>
    `;

    document.body.appendChild(paletteEl);

    const input = paletteEl.querySelector('#cl-palette-input');
    const resultsContainer = paletteEl.querySelector('#cl-palette-results');

    function closePalette() {
      isPaletteOpen = false;
      paletteEl.classList.add('hidden');
      input.value = '';
    }

    function openPalette() {
      isPaletteOpen = true;
      paletteEl.classList.remove('hidden');
      if (CL.util && typeof CL.util.icons === 'function') {
        CL.util.icons();
      }
      setTimeout(() => input.focus(), 50);
      renderResults('');
    }

    function renderResults(query) {
      const q = query.trim().toLowerCase();
      const state = CL.store ? CL.store.get() : {};
      const incidents = state.incidents || [];
      const items = [];

      // Budget command check
      if (q.startsWith('budget')) {
        const parts = q.split(' ');
        const num = parseFloat(parts[1]);
        items.push({
          label: `Set Live Budget to ${isNaN(num) ? '...' : '$' + num + 'M'}`,
          category: 'Action',
          icon: 'dollar-sign',
          action: () => {
            if (!isNaN(num) && CL.store) {
              CL.store.update(s => { s.budget = num; });
              if (CL.ui && typeof CL.ui.toast === 'function') {
                CL.ui.toast(`Live budget set to $${num}M`, 'success');
              }
            }
          }
        });
      }

      // Tab Jump Actions
      const tabs = [
        { id: 'command', label: 'Command View', icon: 'layout-dashboard' },
        { id: 'portal', label: 'Citizen Portal', icon: 'message-square' },
        { id: 'ledger', label: 'Audit Ledger', icon: 'shield-check' },
        { id: 'blueprints', label: 'Blueprints Library', icon: 'book-open' },
        { id: 'report', label: 'Executive Brief', icon: 'file-text' },
        { id: 'map', label: 'Hotspot Map', icon: 'map' },
        { id: 'labs', label: 'Simulation Labs', icon: 'flask-conical' },
        { id: 'scenarios', label: 'Scenario Comparison', icon: 'git-compare' }
      ];

      tabs.forEach(t => {
        if (!q || t.label.toLowerCase().includes(q) || t.id.includes(q)) {
          items.push({
            label: `Switch Tab: ${t.label}`,
            category: 'Navigation',
            icon: t.icon,
            action: () => {
              if (CL.store) {
                CL.store.update(s => { s.activeTab = t.id; });
              }
            }
          });
        }
      });

      // Quick Actions
      if (!q || 'open portal'.includes(q) || 'citizen portal'.includes(q)) {
        items.push({
          label: 'Open Citizen Feedback Drawer',
          category: 'Overlay',
          icon: 'plus-circle',
          action: () => {
            if (CL.ui && typeof CL.ui.open === 'function') {
              CL.ui.open('portal', {});
            }
          }
        });
      }

      if (!q || 'generate brief'.includes(q) || 'open brief'.includes(q)) {
        items.push({
          label: 'Open Executive Brief Overlay',
          category: 'Overlay',
          icon: 'file-text',
          action: () => {
            if (CL.ui && typeof CL.ui.open === 'function') {
              CL.ui.open('brief', {});
            }
          }
        });
      }

      // Incidents Search
      incidents.forEach(inc => {
        if (q && (inc.title.toLowerCase().includes(q) || inc.category.toLowerCase().includes(q) || (inc.neighborhood && inc.neighborhood.toLowerCase().includes(q)))) {
          items.push({
            label: `Incident: ${inc.title}`,
            category: `Incident (${inc.category})`,
            icon: 'alert-triangle',
            action: () => {
              if (CL.store) {
                CL.store.update(s => {
                  s.selectedIssueId = inc.id;
                  s.activeTab = 'command';
                });
              }
            }
          });
        }
      });

      if (items.length === 0) {
        resultsContainer.innerHTML = `<div class="p-4 text-center text-[var(--muted)]">No matching actions or incidents found.</div>`;
        return;
      }

      resultsContainer.innerHTML = items.map((item, idx) => `
        <button data-index="${idx}" class="cl-palette-item w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--bg)] transition-colors text-left focus:bg-[var(--bg)] focus:outline-none">
          <div class="flex items-center gap-2.5">
            <i data-lucide="${item.icon || 'circle'}" class="w-4 h-4 text-[var(--gold)]"></i>
            <span class="font-medium text-[var(--text)]">${CL.util ? CL.util.esc(item.label) : item.label}</span>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">${item.category}</span>
        </button>
      `).join('');

      if (CL.util && typeof CL.util.icons === 'function') {
        CL.util.icons();
      }

      const buttons = resultsContainer.querySelectorAll('.cl-palette-item');
      buttons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          items[idx].action();
          closePalette();
        });
      });
    }

    input.addEventListener('input', (e) => {
      renderResults(e.target.value);
    });

    paletteEl.addEventListener('click', (e) => {
      if (e.target === paletteEl) {
        closePalette();
      }
    });

    // Global listener for shortcut keys
    window.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isPaletteOpen) {
          closePalette();
        } else {
          openPalette();
        }
      } else if (e.key === 'Escape' && isPaletteOpen) {
        closePalette();
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        showKeyboardShortcutsModal();
      }
    });
  }

  // Initialize palette DOM once
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandPalette);
  } else {
    initCommandPalette();
  }

  // Register View 'scenarios'
  if (CL.registerView) {
    CL.registerView('scenarios', {
      label: 'Scenarios',
      icon: 'git-compare',
      order: 6,
      mount: renderLabs2View
    });
  }
})();
