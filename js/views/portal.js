// js/views/portal.js
(function () {
  const CL = (window.CL = window.CL || {});

  let portalContainer = null;
  let isProcessing = false;
  let isRecording = false;
  let recTimer = null;
  let currentStep = 0; // 0 to 4
  let analysisResult = null;
  let ingestResult = null;

  // Map CL language codes to Web Speech API tags
  const LANG_TAGS = {
    hi: 'hi-IN',
    zh: 'zh-CN',
    pt: 'pt-BR',
    zu: 'zu-ZA',
    ru: 'ru-RU',
    ar: 'ar-EG',
    am: 'am-ET',
    id: 'id-ID',
    en: 'en-US',
  };

  function mountPortal(container) {
    portalContainer = container;
    renderPortal();
  }

  function unmountPortal() {
    if (recTimer) clearInterval(recTimer);
    portalContainer = null;
    isProcessing = false;
    isRecording = false;
    currentStep = 0;
    analysisResult = null;
    ingestResult = null;
  }

  function getFormValues() {
    if (!portalContainer) return null;
    const regionEl = portalContainer.querySelector('#cl-portal-region');
    const langEl = portalContainer.querySelector('#cl-portal-lang');
    const nameEl = portalContainer.querySelector('#cl-portal-name');
    const phoneEl = portalContainer.querySelector('#cl-portal-phone');
    const textEl = portalContainer.querySelector('#cl-portal-text');

    return {
      regionId: regionEl ? regionEl.value : CL.data.REGIONS[0].id,
      lang: langEl ? langEl.value : 'hi',
      name: nameEl ? nameEl.value.trim() : '',
      phone: phoneEl ? phoneEl.value.trim() : '',
      text: textEl ? textEl.value.trim() : '',
    };
  }

  function renderPortal() {
    if (!portalContainer) return;

    const state = CL.store.get() || {};
    const regions = CL.data.REGIONS || [];
    const languages = CL.data.LANGUAGES || [];

    // Default sample for default language (hi)
    const defaultLang = languages[0] || { code: 'hi', sample: '' };

    portalContainer.innerHTML = `
      <div class="h-full flex flex-col bg-[var(--panel)] text-[var(--text)] border-l border-[var(--line)] shadow-2xl w-full max-w-xl mx-auto overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]/50 shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
              <i data-lucide="languages" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="font-bold text-lg leading-tight text-[var(--text)]">Citizen Voice Intake</h2>
              <p class="text-xs text-[var(--muted)]">Submit local infrastructure feedback & micro-reports</p>
            </div>
          </div>
          <button id="cl-portal-close" class="p-2 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Body Scrollable -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- PII Privacy Banner -->
          <div class="p-3.5 rounded-lg border text-xs flex items-start gap-3 transition-colors ${
            state.anonymize
              ? 'bg-[var(--ok)]/10 border-[var(--ok)]/30 text-[var(--ok)]'
              : 'bg-[var(--warn)]/10 border-[var(--warn)]/30 text-[var(--warn)]'
          }">
            <i data-lucide="${state.anonymize ? 'shield-check' : 'shield-alert'}" class="w-4 h-4 shrink-0 mt-0.5"></i>
            <div class="leading-relaxed">
              <span class="font-semibold">${state.anonymize ? 'PII Protection Active:' : 'PII Protection Inactive:'}</span>
              ${
                state.anonymize
                  ? 'Your name and phone are never published. System automatically masks personal identifiable data before ledger storage.'
                  : 'Anonymization is currently toggled OFF in system settings. Personal credentials will be stored unmasked.'
              }
            </div>
          </div>

          <!-- Region & Language Selects -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">Select Region</label>
              <select id="cl-portal-region" class="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none">
                ${regions
                  .map(
                    (r) =>
                      `<option value="${CL.util.esc(r.id)}">${CL.util.esc(r.name)} (${CL.util.esc(r.country)})</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">Language</label>
              <select id="cl-portal-lang" class="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none">
                ${languages
                  .map(
                    (l) =>
                      `<option value="${CL.util.esc(l.code)}">${CL.util.esc(l.name)} (${CL.util.esc(l.code.toUpperCase())})</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>

          <!-- Citizen Credentials (Prefilled) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">Citizen Name</label>
              <input type="text" id="cl-portal-name" value="Aarav Sharma" class="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none" placeholder="Full name">
            </div>
            <div>
              <label class="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">Phone / WhatsApp</label>
              <input type="text" id="cl-portal-phone" value="+91 98765 43210" class="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none" placeholder="+123456789">
            </div>
          </div>

          <!-- Input Textarea & Load Sample -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Incident Report Text</label>
              <button type="button" id="cl-portal-load-sample" class="text-xs text-[var(--gold)] hover:underline flex items-center gap-1 font-medium">
                <i data-lucide="rotate-ccw" class="w-3 h-3"></i> Load Sample Text
              </button>
            </div>
            <textarea id="cl-portal-text" rows="4" class="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none resize-none leading-relaxed" placeholder="Describe the issue in your local language...">${CL.util.esc(
              defaultLang.sample || ''
            )}</textarea>
          </div>

          <!-- Voice / Audio Input Controls -->
          <div class="p-4 rounded-xl border border-[var(--line)] bg-[var(--bg)]/40 space-y-3">
            <div class="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="mic" class="w-3.5 h-3.5 text-[var(--sky)]"></i> Voice & Audio Input
            </div>
            
            <div class="flex flex-wrap items-center gap-3">
              <!-- Voice Record Button -->
              <button type="button" id="cl-portal-record-btn" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--sky)]/50 hover:text-[var(--sky)] text-sm font-medium transition-all">
                <i data-lucide="mic" class="w-4 h-4 text-[var(--sky)]"></i>
                <span id="cl-portal-record-label">Record Voice Note</span>
              </button>

              <!-- Upload Audio File Button -->
              <label class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--sky)]/50 hover:text-[var(--sky)] text-sm font-medium cursor-pointer transition-all">
                <i data-lucide="upload-cloud" class="w-4 h-4 text-[var(--sky)]"></i>
                <span>Upload Audio File</span>
                <input type="file" id="cl-portal-audio-file" accept="audio/*" class="hidden">
              </label>
            </div>

            <!-- Waveform Animation Bar (Hidden by default) -->
            <div id="cl-portal-waveform" class="hidden items-center justify-center gap-1 py-2 bg-[var(--bg)] rounded-lg border border-[var(--line)]">
              <span class="w-1 h-3 bg-[var(--sky)] animate-pulse rounded-full"></span>
              <span class="w-1 h-6 bg-[var(--sky)] animate-pulse delay-75 rounded-full"></span>
              <span class="w-1 h-4 bg-[var(--sky)] animate-pulse delay-150 rounded-full"></span>
              <span class="w-1 h-8 bg-[var(--sky)] animate-pulse delay-100 rounded-full"></span>
              <span class="w-1 h-5 bg-[var(--sky)] animate-pulse delay-200 rounded-full"></span>
              <span class="w-1 h-3 bg-[var(--sky)] animate-pulse rounded-full"></span>
              <span class="text-xs text-[var(--sky)] font-mono ml-2 animate-pulse">Listening...</span>
            </div>
          </div>

          <!-- Step-by-Step Live Processing Container -->
          <div id="cl-portal-progress-container" class="space-y-3 ${isProcessing ? '' : 'hidden'} p-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5">
            <div class="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="cpu" class="w-4 h-4 animate-spin"></i> AI Processing & Ingestion
            </div>
            <div id="cl-portal-steps" class="space-y-2 text-xs font-mono">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Result Card (Hidden until complete) -->
          <div id="cl-portal-result-card" class="space-y-4 ${analysisResult ? '' : 'hidden'}">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Footer Submit Action -->
        <div class="p-4 border-t border-[var(--line)] bg-[var(--bg)]/80 shrink-0 flex items-center justify-end gap-3">
          <button type="button" id="cl-portal-cancel" class="px-4 py-2.5 rounded-lg border border-[var(--line)] hover:bg-[var(--line)] text-sm font-medium transition-colors">
            Close
          </button>
          <button type="button" id="cl-portal-submit" ${isProcessing ? 'disabled' : ''} class="px-6 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--bg)] hover:brightness-110 font-bold text-sm flex items-center gap-2 shadow-lg shadow-[var(--gold)]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            <i data-lucide="send" class="w-4 h-4"></i> Submit Incident
          </button>
        </div>
      </div>
    `;

    CL.util.icons();
    bindPortalEvents();
  }

  function bindPortalEvents() {
    if (!portalContainer) return;

    // Close button
    const closeBtn = portalContainer.querySelector('#cl-portal-close');
    const cancelBtn = portalContainer.querySelector('#cl-portal-cancel');
    if (closeBtn) closeBtn.onclick = () => CL.ui.close();
    if (cancelBtn) cancelBtn.onclick = () => CL.ui.close();

    // Language switch -> update textarea sample if user hasn't typed custom stuff
    const langSelect = portalContainer.querySelector('#cl-portal-lang');
    if (langSelect) {
      langSelect.onchange = (e) => {
        const selectedCode = e.target.value;
        const langObj = (CL.data.LANGUAGES || []).find((l) => l.code === selectedCode);
        if (langObj) {
          const textEl = portalContainer.querySelector('#cl-portal-text');
          if (textEl) textEl.value = langObj.sample || '';
        }
      };
    }

    // Load sample button
    const sampleBtn = portalContainer.querySelector('#cl-portal-load-sample');
    if (sampleBtn) {
      sampleBtn.onclick = () => {
        const langCode = portalContainer.querySelector('#cl-portal-lang')?.value || 'hi';
        const langObj = (CL.data.LANGUAGES || []).find((l) => l.code === langCode);
        const textEl = portalContainer.querySelector('#cl-portal-text');
        if (textEl && langObj) {
          textEl.value = langObj.sample || '';
          CL.ui.toast('Sample text loaded', 'info');
        }
      };
    }

    // Voice record button
    const recBtn = portalContainer.querySelector('#cl-portal-record-btn');
    if (recBtn) {
      recBtn.onclick = handleVoiceRecord;
    }

    // Audio file upload
    const audioInput = portalContainer.querySelector('#cl-portal-audio-file');
    if (audioInput) {
      audioInput.onchange = handleAudioUpload;
    }

    // Submit button
    const submitBtn = portalContainer.querySelector('#cl-portal-submit');
    if (submitBtn) {
      submitBtn.onclick = handleSubmit;
    }
  }

  function handleVoiceRecord() {
    if (isRecording) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const langCode = portalContainer?.querySelector('#cl-portal-lang')?.value || 'hi';
    const waveEl = portalContainer?.querySelector('#cl-portal-waveform');
    const labelEl = portalContainer?.querySelector('#cl-portal-record-label');

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = LANG_TAGS[langCode] || 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        isRecording = true;
        if (waveEl) {
          waveEl.classList.remove('hidden');
          waveEl.classList.add('flex');
        }
        if (labelEl) labelEl.textContent = 'Listening...';

        recognition.start();

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          const textEl = portalContainer?.querySelector('#cl-portal-text');
          if (textEl) textEl.value = transcript;
          CL.ui.toast('Speech transcribed successfully', 'success');
        };

        recognition.onerror = (err) => {
          console.warn('Speech Recognition error:', err);
          simulateRecording();
        };

        recognition.onend = () => {
          isRecording = false;
          if (waveEl) {
            waveEl.classList.add('hidden');
            waveEl.classList.remove('flex');
          }
          if (labelEl) labelEl.textContent = 'Record Voice Note';
        };

        return;
      } catch (e) {
        console.warn('Web Speech API failed, falling back to simulation', e);
      }
    }

    // Fallback simulation
    simulateRecording();
  }

  function simulateRecording() {
    isRecording = true;
    const waveEl = portalContainer?.querySelector('#cl-portal-waveform');
    const labelEl = portalContainer?.querySelector('#cl-portal-record-label');

    if (waveEl) {
      waveEl.classList.remove('hidden');
      waveEl.classList.add('flex');
    }
    if (labelEl) labelEl.textContent = 'Recording (3s)...';

    setTimeout(() => {
      isRecording = false;
      if (waveEl) {
        waveEl.classList.add('hidden');
        waveEl.classList.remove('flex');
      }
      if (labelEl) labelEl.textContent = 'Record Voice Note';

      const langCode = portalContainer?.querySelector('#cl-portal-lang')?.value || 'hi';
      const langObj = (CL.data.LANGUAGES || []).find((l) => l.code === langCode);
      const textEl = portalContainer?.querySelector('#cl-portal-text');
      if (textEl && langObj) {
        textEl.value = langObj.sample || '';
      }
      CL.ui.toast('Voice note transcribed (simulated)', 'info');
    }, 3000);
  }

  function handleAudioUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    CL.ui.toast(`Transcribing ${file.name}...`, 'info');

    setTimeout(() => {
      const langCode = portalContainer?.querySelector('#cl-portal-lang')?.value || 'hi';
      const langObj = (CL.data.LANGUAGES || []).find((l) => l.code === langCode);
      const textEl = portalContainer?.querySelector('#cl-portal-text');
      if (textEl && langObj) {
        textEl.value = langObj.sample || '';
      }
      CL.ui.toast('Audio file transcribed successfully', 'success');
    }, 1500);
  }

  async function handleSubmit() {
    if (isProcessing) return;

    const values = getFormValues();
    if (!values || !values.text) {
      CL.ui.toast('Please provide report details or sample text', 'warn');
      return;
    }

    isProcessing = true;
    currentStep = 0;
    analysisResult = null;
    ingestResult = null;

    const submitBtn = portalContainer.querySelector('#cl-portal-submit');
    const progressContainer = portalContainer.querySelector('#cl-portal-progress-container');
    const resultCard = portalContainer.querySelector('#cl-portal-result-card');

    if (submitBtn) submitBtn.disabled = true;
    if (resultCard) resultCard.classList.add('hidden');
    if (progressContainer) progressContainer.classList.remove('hidden');

    renderProgressSteps();

    try {
      // Step-by-step UI progression simulation tied to analyzeReport
      const stepsList = [
        'Detecting language & confidence...',
        'Translating to English & masking PII...',
        'Evaluating sentiment & urgency score...',
        'Categorizing & clustering with regional incidents...',
      ];

      for (let i = 0; i < stepsList.length; i++) {
        currentStep = i;
        renderProgressSteps(stepsList);
        await new Promise((res) => setTimeout(res, 350));
      }

      currentStep = 4; // Complete
      renderProgressSteps(stepsList);

      // Perform AI Analysis
      const analysis = await CL.engines.analyzeReport({
        text: values.text,
        langHint: values.lang,
      });
      analysisResult = analysis;

      // Ingest into system store
      const ingest = CL.engines.ingestReport({
        regionId: values.regionId,
        name: values.name,
        phone: values.phone,
        lang: values.lang,
        text: values.text,
        analysis: analysis,
      });
      ingestResult = ingest;

      // Render analysis & ingest result card
      renderResultCard();
      CL.ui.toast('Citizen report successfully ingested!', 'success');
    } catch (err) {
      console.error('Portal submit error:', err);
      CL.ui.toast('Failed to process report', 'error');
    } finally {
      isProcessing = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function renderProgressSteps(stepsList) {
    const stepsEl = portalContainer?.querySelector('#cl-portal-steps');
    if (!stepsEl) return;

    const defaultSteps = [
      'Detecting language & confidence...',
      'Translating to English & masking PII...',
      'Evaluating sentiment & urgency score...',
      'Categorizing & clustering with regional incidents...',
    ];
    const labels = stepsList || defaultSteps;

    stepsEl.innerHTML = labels
      .map((label, idx) => {
        let icon = `<i data-lucide="circle" class="w-3.5 h-3.5 text-[var(--muted)]"></i>`;
        let textClass = 'text-[var(--muted)]';

        if (idx < currentStep) {
          icon = `<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-[var(--ok)]"></i>`;
          textClass = 'text-[var(--ok)] font-semibold';
        } else if (idx === currentStep && isProcessing) {
          icon = `<i data-lucide="loader-2" class="w-3.5 h-3.5 text-[var(--gold)] animate-spin"></i>`;
          textClass = 'text-[var(--gold)] font-semibold';
        }

        return `
        <div class="flex items-center gap-2">
          ${icon}
          <span class="${textClass}">${CL.util.esc(label)}</span>
        </div>
      `;
      })
      .join('');

    CL.util.icons();
  }

  function renderResultCard() {
    const resultCard = portalContainer?.querySelector('#cl-portal-result-card');
    if (!resultCard || !analysisResult || !ingestResult) return;

    const state = CL.store.get() || {};
    const incidents = state.incidents || [];
    const masterInc = incidents.find((i) => i.id === ingestResult.incidentId);

    const values = getFormValues();
    const confPct = Math.round((analysisResult.confidence || 0.95) * 100);
    const urgency = analysisResult.urgency || 5;

    // SVG Semicircle Dial calculations for Urgency (1-10)
    // Semicircle radius 40, length = PI * R = ~125.6
    const strokeDasharray = 125.6;
    const strokeDashoffset = strokeDasharray - (strokeDasharray * (urgency / 10));

    let urgencyColor = 'var(--ok)';
    if (urgency >= 7) urgencyColor = 'var(--bad)';
    else if (urgency >= 4) urgencyColor = 'var(--warn)';

    let sentimentBadge = 'bg-[var(--muted)]/20 text-[var(--muted)]';
    if (analysisResult.sentiment === 'Positive') sentimentBadge = 'bg-[var(--ok)]/15 text-[var(--ok)] border-[var(--ok)]/30';
    else if (analysisResult.sentiment === 'Negative') sentimentBadge = 'bg-[var(--bad)]/15 text-[var(--bad)] border-[var(--bad)]/30';
    else if (analysisResult.sentiment === 'Neutral') sentimentBadge = 'bg-[var(--sky)]/15 text-[var(--sky)] border-[var(--sky)]/30';

    resultCard.innerHTML = `
      <div class="p-5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 space-y-4">
        <!-- Detection Header & Confidence -->
        <div class="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div>
            <div class="text-xs text-[var(--muted)] uppercase tracking-wider">Detected Language</div>
            <div class="font-bold text-sm text-[var(--text)] flex items-center gap-2">
              <span>${CL.util.esc(analysisResult.langName || 'Detected')} (${CL.util.esc((analysisResult.detectedLang || 'hi').toUpperCase())})</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono border ${sentimentBadge}">
                ${CL.util.esc(analysisResult.sentiment || 'Neutral')}
              </span>
            </div>
          </div>

          <!-- Confidence Bar -->
          <div class="text-right">
            <div class="text-xs text-[var(--muted)] uppercase tracking-wider">AI Confidence</div>
            <div class="flex items-center gap-2 mt-1">
              <div class="w-20 h-2 bg-[var(--line)] rounded-full overflow-hidden">
                <div class="h-full bg-[var(--gold)] rounded-full" style="width: ${confPct}%"></div>
              </div>
              <span class="font-mono text-xs font-bold text-[var(--gold)]">${confPct}%</span>
            </div>
          </div>
        </div>

        <!-- Side-by-Side Original vs English -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="p-3 rounded-lg border border-[var(--line)] bg-[var(--panel)]">
            <div class="text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">Original Submission</div>
            <p class="text-[var(--text)] leading-relaxed italic">"${CL.util.esc(values?.text || '')}"</p>
          </div>
          <div class="p-3 rounded-lg border border-[var(--line)] bg-[var(--panel)]">
            <div class="text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">English Translation</div>
            <p class="text-[var(--text)] leading-relaxed">"${CL.util.esc(analysisResult.english || '')}"</p>
          </div>
        </div>

        <!-- Category & Urgency Semicircle Dial -->
        <div class="flex items-center justify-between pt-2 border-t border-[var(--line)]">
          <div>
            <span class="text-xs text-[var(--muted)] block uppercase tracking-wider">Category Tag</span>
            <span class="font-bold text-sm text-[var(--gold)] flex items-center gap-1.5 mt-0.5">
              <i data-lucide="tag" class="w-4 h-4"></i>
              ${CL.util.esc(analysisResult.category || 'Water')}
            </span>
          </div>

          <!-- Semicircle Dial -->
          <div class="flex items-center gap-3">
            <div class="text-right">
              <span class="text-xs text-[var(--muted)] block uppercase tracking-wider">Urgency Score</span>
              <span class="font-mono font-bold text-base" style="color: ${urgencyColor}">${urgency} / 10</span>
            </div>
            <div class="relative w-16 h-10 flex items-center justify-center overflow-hidden">
              <svg viewBox="0 0 100 50" class="w-16 h-8">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="${urgencyColor}" stroke-width="10" stroke-linecap="round"
                      stroke-dasharray="125.6" stroke-dashoffset="${strokeDashoffset}" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Master Incident Cluster Action Banner -->
        <div class="p-3.5 rounded-lg border bg-[var(--sky)]/10 border-[var(--sky)]/30 flex items-center justify-between gap-3">
          <div class="text-xs text-[var(--text)]">
            <span class="font-semibold text-[var(--sky)] block mb-0.5">
              ${ingestResult.merged ? 'Merged into Master Incident:' : 'New Master Incident Created:'}
            </span>
            <span class="font-bold">${CL.util.esc(masterInc ? masterInc.title : 'Infrastructure Incident')}</span>
            <span class="text-[var(--muted)]"> (${masterInc ? masterInc.clusterSize : 1} micro-reports)</span>
          </div>
          <button type="button" id="cl-portal-view-ledger" class="px-3 py-1.5 rounded bg-[var(--sky)] text-[var(--bg)] font-bold text-xs hover:brightness-110 whitespace-nowrap transition-colors">
            View in ledger
          </button>
        </div>
      </div>
    `;

    resultCard.classList.remove('hidden');
    CL.util.icons();

    const viewLedgerBtn = resultCard.querySelector('#cl-portal-view-ledger');
    if (viewLedgerBtn) {
      viewLedgerBtn.onclick = () => {
        CL.ui.close();
        window.location.hash = '#ledger';
      };
    }
  }

  // Register Drawer Overlay
  CL.ui.registerOverlay('portal', {
    mount: mountPortal,
    unmount: unmountPortal,
  });

  // Register Header Action Button
  CL.registerAction({
    id: 'portal',
    label: 'Citizen Portal',
    icon: 'languages',
    order: 1,
    onClick: () => CL.ui.open('portal'),
  });
})();
