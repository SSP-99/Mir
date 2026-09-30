// js/views/report.js
(function () {
  const CL = window.CL = window.CL || {};

  function parseMarkdown(md) {
    if (!md) return '';
    let esc = CL.util.esc;
    let lines = md.split('\n');
    let inTable = false;
    let tableHeaderDone = false;
    let html = [];

    lines.forEach(line => {
      let trimmed = line.trim();

      // Handle tables
      if (trimmed.startsWith('|')) {
        if (trimmed.includes('---')) {
          tableHeaderDone = true;
          return;
        }
        let cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (!inTable) {
          inTable = true;
          tableHeaderDone = false;
          html.push('<div class="overflow-x-auto my-3"><table class="w-full text-left border-collapse border border-[var(--line)] text-xs">');
        }

        if (!tableHeaderDone) {
          html.push('<thead class="bg-[var(--line)]/50 font-semibold text-[var(--text)]"><tr>');
          cells.forEach(c => html.push(`<th class="p-2 border border-[var(--line)]">${esc(c)}</th>`));
          html.push('</tr></thead><tbody>');
        } else {
          html.push('<tr class="border-b border-[var(--line)]/40 hover:bg-[var(--line)]/20">');
          cells.forEach(c => html.push(`<td class="p-2 border border-[var(--line)]/40 text-[var(--muted)]">${esc(c)}</td>`));
          html.push('</tr>');
        }
        return;
      } else if (inTable) {
        inTable = false;
        html.push('</tbody></table></div>');
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        html.push(`<h1 class="text-xl font-bold text-[var(--gold)] mt-4 mb-2 pb-1 border-b border-[var(--line)]">${esc(trimmed.slice(2))}</h1>`);
      } else if (trimmed.startsWith('## ')) {
        html.push(`<h2 class="text-lg font-bold text-[var(--sky)] mt-4 mb-2">${esc(trimmed.slice(3))}</h2>`);
      } else if (trimmed.startsWith('### ')) {
        html.push(`<h3 class="text-base font-semibold text-[var(--text)] mt-3 mb-1">${esc(trimmed.slice(4))}</h3>`);
      }
      // Lists
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        let content = trimmed.slice(2);
        // bold formatting inside list
        content = esc(content).replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text)]">$1</strong>');
        html.push(`<li class="ml-4 list-disc text-xs text-[var(--muted)] my-0.5">${content}</li>`);
      }
      // Empty lines
      else if (trimmed === '') {
        html.push('<div class="h-2"></div>');
      }
      // Regular paragraphs
      else {
        let content = esc(line).replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text)]">$1</strong>');
        html.push(`<p class="text-xs text-[var(--muted)] leading-relaxed my-1">${content}</p>`);
      }
    });

    if (inTable) html.push('</tbody></table></div>');
    return html.join('');
  }

  function countAnonymizedStats(state) {
    let phoneCount = 0;
    let emailCount = 0;
    let nameCount = 0;

    let phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    let emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    (state.incidents || []).forEach(inc => {
      (inc.reports || []).forEach(rep => {
        let text = (rep.name || '') + ' ' + (rep.phone || '') + ' ' + (rep.originalText || '');
        let pMatches = text.match(phoneRegex);
        if (pMatches) phoneCount += pMatches.length;

        let eMatches = text.match(emailRegex);
        if (eMatches) emailCount += eMatches.length;

        if (rep.name && rep.name !== 'Anonymous') nameCount++;
      });
    });

    return { phones: phoneCount, emails: emailCount, names: nameCount };
  }

  function getSamplePiiData(state) {
    let sampleReport = null;
    if (state.incidents && state.incidents.length > 0) {
      for (let inc of state.incidents) {
        if (inc.reports && inc.reports.length > 0) {
          sampleReport = inc.reports[0];
          break;
        }
      }
    }

    let raw = sampleReport 
      ? `Reported by ${sampleReport.name || 'John Doe'} (${sampleReport.phone || '+1-555-0199'}): "${sampleReport.originalText || 'Water leaking near high street main valve.'}"`
      : 'Reported by Priya Sharma (+91-98765-43210, priya@example.com): "Critical water outage in Sector 4 block B."';

    let anonymized = CL.engines.anonymizeText ? CL.engines.anonymizeText(raw) : raw;

    let highlightedPii = raw
      .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, '<mark class="bg-[var(--bad)]/30 text-[var(--bad)] px-1 rounded">$&</mark>')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '<mark class="bg-[var(--bad)]/30 text-[var(--bad)] px-1 rounded">$&</mark>')
      .replace(/(Priya Sharma|John Doe|Amit Patel|Carlos Silva|Wei Zhang)/g, '<mark class="bg-[var(--warn)]/30 text-[var(--warn)] px-1 rounded">$&</mark>');

    return { raw, highlightedPii, anonymized };
  }

  CL.ui.registerOverlay('brief', {
    mount(container) {
      let viewMode = 'preview'; // 'preview' | 'raw'
      let overrideWarningAck = false;
      let unsubscribe = null;

      function render() {
        let state = CL.store.get();
        let isAnon = !!state.anonymize;
        let stats = countAnonymizedStats(state);
        let sample = getSamplePiiData(state);
        let briefMd = CL.engines.generateBrief ? CL.engines.generateBrief({ anonymize: isAnon }) : '# Executive Brief\nNo engine loaded.';

        let isDisabled = !isAnon && !overrideWarningAck;

        let html = `
          <div class="p-6 max-w-4xl w-full mx-auto max-h-[90vh] overflow-y-auto space-y-6 text-[var(--text)]">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div class="flex items-center space-x-3">
                <div class="p-2 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)]">
                  <i data-lucide="file-text" class="w-6 h-6"></i>
                </div>
                <div>
                  <h2 class="text-xl font-bold tracking-wide">Executive Briefing & Data Export</h2>
                  <p class="text-xs text-[var(--muted)]">BRICS+ Infrastructure & Public Feedback Dossier</p>
                </div>
              </div>
              <button id="close-modal-btn" class="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--line)]/50 transition">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
            </div>

            <!-- Anonymization Pipeline Panel -->
            <div class="p-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <i data-lucide="shield" class="w-5 h-5 text-[var(--sky)]"></i>
                  <span class="font-semibold text-sm">Privacy & Anonymization Engine</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="brief-anon-toggle" class="sr-only peer" ${isAnon ? 'checked' : ''}>
                  <div class="w-11 h-6 bg-[var(--line)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--ok)]"></div>
                  <span class="ml-3 text-xs font-medium text-[var(--text)]">${isAnon ? 'Active (Strict PII Masking)' : 'Disabled (Raw Data)'}</span>
                </label>
              </div>

              <!-- 3-Stage Visual Flow -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div class="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[10px] uppercase font-mono text-[var(--muted)] mb-1">Stage 1: Raw Citizen Feed</div>
                  <div class="text-xs font-mono text-[var(--muted)] truncate">${CL.util.esc(sample.raw)}</div>
                </div>
                <div class="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[10px] uppercase font-mono text-[var(--warn)] mb-1">Stage 2: PII Detection</div>
                  <div class="text-xs font-mono">${sample.highlightedPii}</div>
                </div>
                <div class="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                  <div class="text-[10px] uppercase font-mono text-[var(--ok)] mb-1">Stage 3: Public Dataset</div>
                  <div class="text-xs font-mono text-[var(--ok)]">${CL.util.esc(sample.anonymized)}</div>
                </div>
              </div>

              <!-- Aggregated Stats -->
              <div class="flex items-center space-x-6 text-xs text-[var(--muted)] font-mono bg-[var(--bg)]/50 p-2.5 rounded-lg border border-[var(--line)]/50">
                <span>PII Neutralized Across Active Incidents:</span>
                <span class="text-[var(--gold)] font-bold">${stats.names} Names</span>
                <span class="text-[var(--sky)] font-bold">${stats.phones} Phones</span>
                <span class="text-[var(--ok)] font-bold">${stats.emails} Emails</span>
              </div>
            </div>

            <!-- Warning Banner if Anonymization OFF -->
            ${!isAnon ? `
              <div class="p-4 rounded-xl border border-[var(--bad)]/40 bg-[var(--bad)]/10 text-[var(--bad)] space-y-3">
                <div class="flex items-start space-x-3">
                  <i data-lucide="alert-triangle" class="w-5 h-5 shrink-0 mt-0.5"></i>
                  <div class="space-y-1">
                    <h4 class="font-bold text-sm">Warning: Exporting Unmasked Personally Identifiable Information (PII)</h4>
                    <p class="text-xs opacity-90">
                      Anonymization is currently turned OFF. Disseminating unredacted citizen telemetry violates data protection standards across several BRICS+ jurisdictions.
                    </p>
                  </div>
                </div>
                <label class="flex items-center space-x-2 text-xs text-[var(--text)] font-medium cursor-pointer pt-1">
                  <input type="checkbox" id="warning-ack-checkbox" class="rounded border-[var(--line)] text-[var(--gold)] focus:ring-0" ${overrideWarningAck ? 'checked' : ''}>
                  <span>I understand this dataset contains unredacted personal data and accept statutory responsibility.</span>
                </label>
              </div>
            ` : ''}

            <!-- Executive Brief Preview / Raw -->
            <div class="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--bg)]">
                <div class="flex items-center space-x-2">
                  <i data-lucide="file-code" class="w-4 h-4 text-[var(--gold)]"></i>
                  <span class="text-xs font-semibold uppercase tracking-wider">Executive Brief Preview</span>
                </div>
                <div class="flex rounded-lg border border-[var(--line)] p-0.5 bg-[var(--panel)]">
                  <button id="btn-mode-preview" class="px-3 py-1 text-xs rounded-md font-medium transition ${viewMode === 'preview' ? 'bg-[var(--gold)] text-black font-semibold' : 'text-[var(--muted)] hover:text-[var(--text)]'}">
                    Rendered
                  </button>
                  <button id="btn-mode-raw" class="px-3 py-1 text-xs rounded-md font-medium transition ${viewMode === 'raw' ? 'bg-[var(--gold)] text-black font-semibold' : 'text-[var(--muted)] hover:text-[var(--text)]'}">
                    Raw Markdown
                  </button>
                </div>
              </div>

              <div class="p-6 max-h-[350px] overflow-y-auto font-sans">
                ${viewMode === 'preview'
                  ? `<div class="prose prose-invert max-w-none">${parseMarkdown(briefMd)}</div>`
                  : `<textarea readonly class="w-full h-72 font-mono text-xs bg-[var(--bg)] text-[var(--text)] p-3 rounded-lg border border-[var(--line)] focus:outline-none resize-none">${CL.util.esc(briefMd)}</textarea>`
                }
              </div>
            </div>

            <!-- Export Action Buttons -->
            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div class="flex flex-wrap items-center gap-2">
                <button id="btn-copy-md" ${isDisabled ? 'disabled' : ''} class="flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--line)] hover:bg-[var(--line)]/80 text-[var(--text)] transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <i data-lucide="copy" class="w-4 h-4"></i>
                  <span>Copy Text</span>
                </button>
                <button id="btn-dl-md" ${isDisabled ? 'disabled' : ''} class="flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--line)] hover:bg-[var(--line)]/80 text-[var(--text)] transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <i data-lucide="download" class="w-4 h-4"></i>
                  <span>Download .md</span>
                </button>
                <button id="btn-dl-json" ${isDisabled ? 'disabled' : ''} class="flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--line)] hover:bg-[var(--line)]/80 text-[var(--text)] transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <i data-lucide="database" class="w-4 h-4"></i>
                  <span>Export JSON</span>
                </button>
                <button id="btn-print-pdf" ${isDisabled ? 'disabled' : ''} class="flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <i data-lucide="printer" class="w-4 h-4"></i>
                  <span>Print to PDF</span>
                </button>
              </div>
            </div>

            <!-- Integrity & Audit Panel -->
            <div class="p-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <i data-lucide="link-2" class="w-4 h-4 text-[var(--sky)]"></i>
                  <span class="text-xs font-semibold uppercase tracking-wider">Cryptographic Ledger Integrity</span>
                </div>
                <div id="verify-status-badge" class="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]">
                  ${(state.audit || []).length} Block(s) Recorded
                </div>
              </div>

              <div class="flex items-center justify-between text-xs">
                <div class="text-[var(--muted)]">
                  SHA-256 Hash Chain verification ensures compliance with immutable audit trail protocols.
                </div>
                <button id="btn-verify-audit" class="px-3 py-1.5 rounded-lg border border-[var(--sky)]/40 bg-[var(--sky)]/10 text-[var(--sky)] hover:bg-[var(--sky)]/20 transition font-mono font-medium shrink-0 ml-4">
                  Verify Chain
                </button>
              </div>
            </div>
          </div>
        `;

        container.innerHTML = html;
        CL.util.icons();
        bindEvents();
      }

      function bindEvents() {
        let state = CL.store.get();

        let closeBtn = container.querySelector('#close-modal-btn');
        if (closeBtn) closeBtn.onclick = () => CL.ui.close();

        let anonToggle = container.querySelector('#brief-anon-toggle');
        if (anonToggle) {
          anonToggle.onchange = (e) => {
            CL.store.update(s => { s.anonymize = e.target.checked; });
          };
        }

        let ackCheckbox = container.querySelector('#warning-ack-checkbox');
        if (ackCheckbox) {
          ackCheckbox.onchange = (e) => {
            overrideWarningAck = e.target.checked;
            render();
          };
        }

        let modePreviewBtn = container.querySelector('#btn-mode-preview');
        let modeRawBtn = container.querySelector('#btn-mode-raw');
        if (modePreviewBtn) modePreviewBtn.onclick = () => { viewMode = 'preview'; render(); };
        if (modeRawBtn) modeRawBtn.onclick = () => { viewMode = 'raw'; render(); };

        // Export handlers
        let isAnon = !!state.anonymize;

        let copyBtn = container.querySelector('#btn-copy-md');
        if (copyBtn) {
          copyBtn.onclick = () => {
            let md = CL.engines.generateBrief ? CL.engines.generateBrief({ anonymize: isAnon }) : '';
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(md).then(() => {
                CL.ui.toast('Brief copied to clipboard', 'success');
              }).catch(() => {
                fallbackCopy(md);
              });
            } else {
              fallbackCopy(md);
            }
          };
        }

        let dlMdBtn = container.querySelector('#btn-dl-md');
        if (dlMdBtn) {
          dlMdBtn.onclick = () => {
            let md = CL.engines.generateBrief ? CL.engines.generateBrief({ anonymize: isAnon }) : '';
            CL.util.download(`CivicLens_Brief_${Date.now()}.md`, md, 'text/markdown');
            CL.ui.toast('Downloaded Executive Brief (.md)', 'info');
          };
        }

        let dlJsonBtn = container.querySelector('#btn-dl-json');
        if (dlJsonBtn) {
          dlJsonBtn.onclick = () => {
            let incidents = (state.incidents || []).map(inc => {
              let copy = JSON.parse(JSON.stringify(inc));
              if (isAnon && CL.engines.maskReport) {
                copy.reports = (copy.reports || []).map(r => CL.engines.maskReport(r, true));
              }
              return copy;
            });

            let payload = {
              exportedAt: new Date().toISOString(),
              anonymized: isAnon,
              incidents: incidents
            };

            CL.util.download(`CivicLens_Dataset_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
            CL.ui.toast('Exported dataset JSON', 'info');
          };
        }

        let printPdfBtn = container.querySelector('#btn-print-pdf');
        if (printPdfBtn) {
          printPdfBtn.onclick = () => {
            window.print();
          };
        }

        let verifyBtn = container.querySelector('#btn-verify-audit');
        if (verifyBtn) {
          verifyBtn.onclick = () => {
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'Verifying...';
            if (CL.engines.verifyAudit) {
              CL.engines.verifyAudit().then(res => {
                let badge = container.querySelector('#verify-status-badge');
                if (res && res.ok) {
                  if (badge) {
                    badge.className = 'text-xs font-mono px-2.5 py-0.5 rounded-full bg-[var(--ok)]/20 text-[var(--ok)] border border-[var(--ok)]/40';
                    badge.innerHTML = '✓ Chain Valid & Intact';
                  }
                  CL.ui.toast('Cryptographic audit chain verified successfully', 'success');
                } else {
                  if (badge) {
                    badge.className = 'text-xs font-mono px-2.5 py-0.5 rounded-full bg-[var(--bad)]/20 text-[var(--bad)] border border-[var(--bad)]/40';
                    badge.innerHTML = `✕ Broken at Block #${res ? res.brokenAt : '?'}`;
                  }
                  CL.ui.toast('Audit chain verification failed', 'error');
                }
                verifyBtn.disabled = false;
                verifyBtn.innerText = 'Verify Chain';
              }).catch(() => {
                verifyBtn.disabled = false;
                verifyBtn.innerText = 'Verify Chain';
                CL.ui.toast('Verification error', 'error');
              });
            }
          };
        }
      }

      function fallbackCopy(text) {
        let ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          CL.ui.toast('Brief copied to clipboard', 'success');
        } catch (e) {
          CL.ui.toast('Failed to copy', 'error');
        }
        document.body.removeChild(ta);
      }

      unsubscribe = CL.bus.on('state', () => {
        render();
      });

      render();

      return function unmount() {
        if (unsubscribe) unsubscribe();
      };
    }
  });

  if (CL.registerAction) {
    CL.registerAction({
      id: 'brief',
      label: 'Executive Brief',
      icon: 'file-text',
      order: 2,
      onClick: () => CL.ui.open('brief')
    });
  }
})();
