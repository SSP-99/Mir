'use strict';

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(__dirname, 'civiclens.db');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ---------------------------------------------------------
   SQLite persistence
--------------------------------------------------------- */

const db = new Database(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    type TEXT NOT NULL,
    msg TEXT NOT NULL,
    hash TEXT NOT NULL,
    prevHash TEXT NOT NULL
  );
`);

function seedState() {
  return {
    budget: 90,
    anonymize: true,
    selectedIssueId: null,
    activeTab: 'command',
    incidents: [],
    plan: {},
    audit: []
  };
}

function readState() {
  const row = db.prepare('SELECT state FROM app_state WHERE id = 1').get();

  if (!row) {
    const state = seedState();
    writeState(state);
    return state;
  }

  try {
    return JSON.parse(row.state);
  } catch (_) {
    const state = seedState();
    writeState(state);
    return state;
  }
}

function writeState(state) {
  db.prepare(`
    INSERT INTO app_state (id, state, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state = excluded.state,
      updated_at = excluded.updated_at
  `).run(JSON.stringify(state), new Date().toISOString());
}

/* ---------------------------------------------------------
   Validation
--------------------------------------------------------- */

const VALID_SENTIMENTS = new Set(['Positive', 'Neutral', 'Negative']);
const VALID_CATEGORIES = new Set([
  'Water',
  'Power',
  'Roads',
  'Waste',
  'Transit',
  'Sanitation'
]);

const VALID_TABS = new Set([
  'command',
  'portal',
  'ledger',
  'blueprints',
  'report',
  'map',
  'labs',
  'labs2'
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateReport(report) {
  if (!isPlainObject(report)) return 'report must be an object';

  const requiredStrings = [
    'id',
    'name',
    'phone',
    'lang',
    'originalText',
    'englishText',
    'sentiment',
    'ts'
  ];

  for (const key of requiredStrings) {
    if (typeof report[key] !== 'string') {
      return `report.${key} must be a string`;
    }
  }

  if (!VALID_SENTIMENTS.has(report.sentiment)) {
    return 'report.sentiment is invalid';
  }

  if (!Number.isInteger(report.urgency) || report.urgency < 1 || report.urgency > 10) {
    return 'report.urgency must be an integer from 1 to 10';
  }

  return null;
}

function validateIncident(incident) {
  if (!isPlainObject(incident)) return 'incident must be an object';

  const strings = [
    'id',
    'regionId',
    'title',
    'neighborhood',
    'category',
    'sentiment',
    'createdAt'
  ];

  for (const key of strings) {
    if (typeof incident[key] !== 'string') {
      return `incident.${key} must be a string`;
    }
  }

  if (!VALID_CATEGORIES.has(incident.category)) {
    return 'incident.category is invalid';
  }

  if (!VALID_SENTIMENTS.has(incident.sentiment)) {
    return 'incident.sentiment is invalid';
  }

  if (!Number.isInteger(incident.urgency) || incident.urgency < 1 || incident.urgency > 10) {
    return 'incident.urgency must be an integer from 1 to 10';
  }

  if (!isFiniteNumber(incident.estCost) || incident.estCost < 0) {
    return 'incident.estCost must be a non-negative number';
  }

  if (!Number.isInteger(incident.clusterSize) || incident.clusterSize < 0) {
    return 'incident.clusterSize must be a non-negative integer';
  }

  if (!Number.isFinite(incident.slaHours) || incident.slaHours < 0) {
    return 'incident.slaHours must be a non-negative number';
  }

  if (!Array.isArray(incident.reports) || incident.reports.length > 8) {
    return 'incident.reports must be an array with at most 8 reports';
  }

  for (const report of incident.reports) {
    const error = validateReport(report);
    if (error) return error;
  }

  return null;
}

function validateState(state) {
  if (!isPlainObject(state)) {
    return 'state must be an object';
  }

  if (!isFiniteNumber(state.budget) || state.budget < 0) {
    return 'budget must be a non-negative number';
  }

  if (typeof state.anonymize !== 'boolean') {
    return 'anonymize must be boolean';
  }

  if (state.selectedIssueId !== null && typeof state.selectedIssueId !== 'string') {
    return 'selectedIssueId must be null or string';
  }

  if (typeof state.activeTab !== 'string' || !VALID_TABS.has(state.activeTab)) {
    return 'activeTab is invalid';
  }

  if (!Array.isArray(state.incidents)) {
    return 'incidents must be an array';
  }

  if (!isPlainObject(state.plan)) {
    return 'plan must be an object';
  }

  if (!Array.isArray(state.audit)) {
    return 'audit must be an array';
  }

  for (const incident of state.incidents) {
    const error = validateIncident(incident);
    if (error) return error;
  }

  return null;
}

function validateReportInput(body) {
  if (!isPlainObject(body)) return 'request body must be an object';

  const required = ['regionId', 'name', 'phone', 'lang', 'text', 'analysis'];

  for (const key of required) {
    if (body[key] === undefined || body[key] === null) {
      return `${key} is required`;
    }
  }

  for (const key of ['regionId', 'name', 'phone', 'lang', 'text']) {
    if (typeof body[key] !== 'string') {
      return `${key} must be a string`;
    }
  }

  if (!isPlainObject(body.analysis)) {
    return 'analysis must be an object';
  }

  if (body.text.length > 10000) {
    return 'text is too long';
  }

  if (body.name.length > 200 || body.phone.length > 100) {
    return 'report identity fields are too long';
  }

  return null;
}

/* ---------------------------------------------------------
   Rate limiter
--------------------------------------------------------- */

const rateBuckets = new Map();

function rateLimit({ windowMs = 60 * 1000, max = 120 } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let bucket = rateBuckets.get(key);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = {
        start: now,
        count: 0
      };
      rateBuckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    next();
  };
}

app.use('/api/', rateLimit());

setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;

  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.start < cutoff) {
      rateBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/* ---------------------------------------------------------
   Audit hashing
--------------------------------------------------------- */

function canonicalAuditString(item) {
  return [
    item.ts,
    item.type,
    item.msg,
    item.prevHash
  ].join('|');
}

function computeHash(item) {
  return crypto
    .createHash('sha256')
    .update(canonicalAuditString(item), 'utf8')
    .digest('hex');
}

function normalizeAudit(audit) {
  if (!Array.isArray(audit)) return [];

  return audit.map((item) => ({
    id: String(item.id || ''),
    ts: String(item.ts || ''),
    type: String(item.type || ''),
    msg: String(item.msg || ''),
    hash: String(item.hash || ''),
    prevHash: String(item.prevHash || '')
  }));
}

function validateAuditChain(audit) {
  const chain = normalizeAudit(audit);

  for (let i = 0; i < chain.length; i += 1) {
    const current = chain[i];
    const expectedPrev = i === 0 ? '' : chain[i - 1].hash;

    if (current.prevHash !== expectedPrev) {
      return {
        ok: false,
        brokenAt: i
      };
    }

    if (!current.ts || !current.type || !current.msg || !current.hash) {
      return {
        ok: false,
        brokenAt: i
      };
    }

    const expectedHash = computeHash(current);

    if (current.hash !== expectedHash) {
      return {
        ok: false,
        brokenAt: i
      };
    }
  }

  return {
    ok: true,
    brokenAt: null
  };
}

function nextAuditEntry(type, msg, existingAudit) {
  const audit = normalizeAudit(existingAudit);
  const ts = new Date().toISOString();
  const prevHash = audit.length ? audit[audit.length - 1].hash : '';

  const entry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    ts,
    type,
    msg,
    prevHash,
    hash: ''
  };

  entry.hash = computeHash(entry);

  return entry;
}

/* ---------------------------------------------------------
   Server-side anonymization
--------------------------------------------------------- */

function anonymizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      '[EMAIL]'
    )
    .replace(
      /(\+?\d{1,3}[\s.-]?)?(?:\d[\s.-]?){8,14}\d/g,
      '[PHONE]'
    )
    .replace(
      /\b(?:aadhaar|aadhar|passport|pan|voter|id|identity)\s*(?:no|number|#|id)?\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi,
      '[ID]'
    )
    .replace(
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      '[ID]'
    );
}

function anonymizeIncident(incident) {
  const copy = JSON.parse(JSON.stringify(incident));

  copy.title = anonymizeText(copy.title);
  copy.neighborhood = anonymizeText(copy.neighborhood);

  if (Array.isArray(copy.reports)) {
    copy.reports = copy.reports.map((report) => ({
      ...report,
      name: '[NAME]',
      phone: '[PHONE]',
      originalText: anonymizeText(report.originalText),
      englishText: anonymizeText(report.englishText)
    }));
  }

  return copy;
}

/* ---------------------------------------------------------
   Brief generation
--------------------------------------------------------- */

function generateBrief(state, anonymize = true) {
  const incidents = Array.isArray(state.incidents) ? state.incidents : [];

  const totalReports = incidents.reduce(
    (sum, incident) => sum + Number(incident.clusterSize || 0),
    0
  );

  const activeHotspots = incidents.filter(
    (incident) => Number(incident.urgency) >= 7
  );

  const totalEstimatedCost = incidents.reduce(
    (sum, incident) => sum + Number(incident.estCost || 0),
    0
  );

  const deployed = incidents.filter(
    (incident) => state.plan && state.plan[incident.id]
  );

  const lines = [
    '# CivicLens BRICS — Infrastructure Brief',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Executive Summary',
    '',
    `- Budget envelope: $${Number(state.budget || 0).toFixed(1)}M`,
    `- Incident clusters: ${incidents.length}`,
    `- Citizen reports represented: ${totalReports.toLocaleString()}`,
    `- Active hotspots: ${activeHotspots.length}`,
    `- Estimated incident cost: $${totalEstimatedCost.toFixed(1)}M`,
    `- Deployed blueprints: ${deployed.length}`,
    '',
    '## Priority Incidents',
    ''
  ];

  if (!incidents.length) {
    lines.push('No incidents are currently recorded.');
  } else {
    const sorted = [...incidents].sort(
      (a, b) => Number(b.urgency || 0) - Number(a.urgency || 0)
    );

    for (const incident of sorted) {
      const item = anonymize
        ? anonymizeIncident(incident)
        : incident;

      lines.push(
        `### ${item.title}`,
        '',
        `- Region: ${item.regionId}`,
        `- Neighborhood: ${item.neighborhood}`,
        `- Category: ${item.category}`,
        `- Urgency: ${item.urgency}/10`,
        `- Sentiment: ${item.sentiment}`,
        `- Estimated cost: $${Number(item.estCost || 0).toFixed(1)}M`,
        `- Cluster size: ${Number(item.clusterSize || 0).toLocaleString()}`,
        `- SLA: ${Number(item.slaHours || 0)} hours`,
        ''
      );
    }
  }

  lines.push(
    '## Deployment Plan',
    ''
  );

  if (!deployed.length) {
    lines.push('No blueprints have been deployed.');
  } else {
    for (const incident of deployed) {
      const item = anonymize ? anonymizeIncident(incident) : incident;
      lines.push(
        `- ${item.title}: blueprint \`${state.plan[incident.id]}\``
      );
    }
  }

  lines.push(
    '',
    '## Governance',
    '',
    '- Citizen-submitted identity fields should be protected before public reporting.',
    '- Audit records are maintained as a hash chain.',
    '- Infrastructure prioritization should be reviewed by authorized decision-makers before implementation.',
    ''
  );

  return lines.join('\n');
}

/* ---------------------------------------------------------
   REST API
--------------------------------------------------------- */

app.get('/api/state', (req, res) => {
  try {
    const state = readState();
    res.json(state);
  } catch (error) {
    res.status(500).json({
      error: 'Unable to read application state.'
    });
  }
});

app.put('/api/state', (req, res) => {
  const state = req.body;
  const error = validateState(state);

  if (error) {
    return res.status(400).json({
      error
    });
  }

  const auditResult = validateAuditChain(state.audit);

  if (!auditResult.ok) {
    return res.status(400).json({
      error: 'Audit chain is invalid.',
      brokenAt: auditResult.brokenAt
    });
  }

  try {
    writeState(state);
    res.json({
      ok: true,
      state: readState()
    });
  } catch (_) {
    res.status(500).json({
      error: 'Unable to persist application state.'
    });
  }
});

app.post('/api/reports', (req, res) => {
  const error = validateReportInput(req.body);

  if (error) {
    return res.status(400).json({
      error
    });
  }

  try {
    const state = readState();
    const body = req.body;
    const analysis = body.analysis;

    const now = new Date().toISOString();
    const similarityText = String(body.text).trim().toLowerCase();

    let matchingIncident = null;

    for (const incident of state.incidents) {
      if (
        incident.regionId === body.regionId &&
        incident.category === analysis.category
      ) {
        const incidentText = `${incident.title} ${incident.neighborhood}`
          .toLowerCase();

        if (
          similarityText &&
          incidentText &&
          (
            similarityText.includes(incidentText) ||
            incidentText.includes(similarityText)
          )
        ) {
          matchingIncident = incident;
          break;
        }
      }
    }

    const report = {
      id: `report-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: body.name,
      phone: body.phone,
      lang: body.lang,
      originalText: body.text,
      englishText: String(analysis.english || body.text),
      sentiment: VALID_SENTIMENTS.has(analysis.sentiment)
        ? analysis.sentiment
        : 'Neutral',
      urgency: Math.max(
        1,
        Math.min(10, Number(analysis.urgency) || 1)
      ),
      ts: now
    };

    if (matchingIncident) {
      matchingIncident.clusterSize =
        Number(matchingIncident.clusterSize || 0) + 1;

      if (!Array.isArray(matchingIncident.reports)) {
        matchingIncident.reports = [];
      }

      if (matchingIncident.reports.length < 8) {
        matchingIncident.reports.push(report);
      }

      const auditEntry = nextAuditEntry(
        'report-merged',
        `Report ${report.id} merged into incident ${matchingIncident.id}`,
        state.audit
      );

      state.audit.push(auditEntry);
      writeState(state);

      return res.status(201).json({
        incidentId: matchingIncident.id,
        merged: true,
        reportId: report.id
      });
    }

    const category = VALID_CATEGORIES.has(analysis.category)
      ? analysis.category
      : 'Roads';

    const incident = {
      id: `incident-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      regionId: body.regionId,
      title: String(analysis.title || `${category} citizen report`),
      neighborhood: String(analysis.neighborhood || 'Unspecified'),
      category,
      urgency: report.urgency,
      sentiment: report.sentiment,
      estCost: Number(analysis.estCost) >= 0
        ? Number(analysis.estCost)
        : 1,
      clusterSize: 1,
      createdAt: now,
      slaHours: Number(analysis.slaHours) >= 0
        ? Number(analysis.slaHours)
        : 24,
      reports: [report]
    };

    state.incidents.push(incident);

    const auditEntry = nextAuditEntry(
      'report-created',
      `Report ${report.id} created incident ${incident.id}`,
      state.audit
    );

    state.audit.push(auditEntry);
    writeState(state);

    res.status(201).json({
      incidentId: incident.id,
      merged: false,
      reportId: report.id
    });
  } catch (_) {
    res.status(500).json({
      error: 'Unable to ingest report.'
    });
  }
});

app.get('/api/brief', (req, res) => {
  try {
    const state = readState();
    const anonymize = String(req.query.anonymize).toLowerCase() !== 'false';

    res.type('text/markdown').send(
      generateBrief(state, anonymize)
    );
  } catch (_) {
    res.status(500).type('text/plain').send(
      'Unable to generate brief.'
    );
  }
});

app.get('/api/audit', (req, res) => {
  try {
    const state = readState();
    const audit = normalizeAudit(state.audit);
    const verification = validateAuditChain(audit);

    res.json({
      audit,
      verification
    });
  } catch (_) {
    res.status(500).json({
      error: 'Unable to read audit ledger.'
    });
  }
});

app.post('/api/audit', (req, res) => {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({
      error: 'request body must be an object'
    });
  }

  const type = String(req.body.type || '').trim();
  const msg = String(req.body.msg || '').trim();

  if (!type || !msg) {
    return res.status(400).json({
      error: 'type and msg are required'
    });
  }

  if (type.length > 100 || msg.length > 2000) {
    return res.status(400).json({
      error: 'type or msg is too long'
    });
  }

  try {
    const state = readState();
    const verification = validateAuditChain(state.audit);

    if (!verification.ok) {
      return res.status(409).json({
        error: 'Existing audit chain is invalid.',
        brokenAt: verification.brokenAt
      });
    }

    const entry = nextAuditEntry(type, msg, state.audit);
    state.audit.push(entry);

    writeState(state);

    res.status(201).json({
      entry,
      verification: {
        ok: true,
        brokenAt: null
      }
    });
  } catch (_) {
    res.status(500).json({
      error: 'Unable to append audit entry.'
    });
  }
});

/* ---------------------------------------------------------
   Static frontend
--------------------------------------------------------- */

app.use(express.static(ROOT));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  const indexFile = path.join(ROOT, 'index.html');

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.status(404).send('CivicLens index.html not found.');
});

/* ---------------------------------------------------------
   Error handling
--------------------------------------------------------- */

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON.'
    });
  }

  console.error(err);

  res.status(500).json({
    error: 'Internal server error.'
  });
});

app.listen(PORT, () => {
  console.log(`CivicLens server running at http://localhost:${PORT}`);
});
