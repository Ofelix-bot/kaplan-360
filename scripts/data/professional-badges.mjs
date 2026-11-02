// Rebuilds data/raw/professional-badges.json from saved official sources.
//
// A badge means: the official Singapore rule makes THIS master's degree itself
// count toward a Singapore professional qualification. Accuracy over coverage —
// a programme gets a badge only when official text supports it.
//
// Inputs (saved copies, see data/sources/badges/sources.json for URLs + dates):
//   data/sources/badges/raw/apac-full-program-list.csv   APAC "Download Full Program List"
//   data/sources/badges/raw/sps-srp.html                 SPS Singapore Register of Psychologists rule
//   data/sources/badges/raw/hkps-dep-*.html              HKPS Division of Educational Psychology programmes
//   data/sources/badges/raw/isca-scaq-professional-programme.html  ISCA SCAQ academic requirements
//   data/sources/badges/raw/sile-us.html                 SILE approved overseas universities (AU/NZ/US schedules)
//
// Usage: node scripts/data/professional-badges.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'data', 'sources', 'badges');
const CHECKED = '2026-11-02';

const programmes = JSON.parse(readFileSync(join(ROOT, 'data/raw/programmes.json'), 'utf8')).programmes;

// ---------------------------------------------------------------------------
// Rules (one-sentence English summaries of the official text)
// ---------------------------------------------------------------------------
const RULES = {
  psychology: {
    text:
      "SRP registration needs a postgraduate applied-psychology master's or doctorate (minimum 2 years full-time, with assessment/intervention coursework, supervised practicum and a thesis) that enables practice as a psychologist and, if overseas, is accredited by that country's psychological society or registration body; counselling, psychotherapy, family therapy, behaviour analysis and research-only degrees do not qualify.",
    url: 'https://psychology.org.sg/srp_membership/srp/',
  },
  accounting: {
    text:
      "Only the listed direct-entry degrees (including NTU's MSc Accountancy and SMU's Master of Professional Accounting) admit straight to the Singapore CA Qualification Professional Programme; any other accredited or ACRA-recognised degree must first complete the SCAQ Foundation Programme.",
    url: 'https://isca.org.sg/qualifications/scaq/professional-programme',
  },
  law: {
    text:
      'A Qualified Person must hold an applicable law degree (LL.B or, from listed Australian and US schools, a J.D.) from a university in the Legal Profession (Qualified Persons) Rules schedules, rank in the top 70% of the cohort, and be a Singapore citizen or PR when it is conferred.',
    url: 'https://www.sile.edu.sg/United-States-of-America-Approved-Universities',
  },
};

// ---------------------------------------------------------------------------
// 1. Psychology — Australia (APAC)
// APAC study levels: "Level 3 - 4" = 2-year master's in an area of practice
// (5th + 6th year). "Level 3" (1-year Master of Professional Psychology) and
// "Level 2 - 3" fail the SRP 2-year minimum; "Level 4" only = advanced-entry /
// post-registration top-ups for people already registered. Discontinued and
// teach-out programmes are not badged.
// ---------------------------------------------------------------------------
const APAC_URL = 'https://apac.au/accredited-programs/search-a-program/';

// APAC provider name -> our institutionId (hand-checked).
const APAC_PROVIDERS = {
  'Adelaide University': 'adelaide-university',
  'The University of Adelaide': 'adelaide-university',
  'University of South Australia': 'adelaide-university',
  'Australian Catholic University': 'australian-catholic-university',
  'Bond University Limited': 'bond-university',
  'Central Queensland University': 'central-queensland-university',
  'Charles Darwin University': 'charles-darwin-university',
  'Curtin University': 'curtin-university',
  'Deakin University': 'deakin-university',
  'Edith Cowan University': 'edith-cowan-university',
  'Griffith University': 'griffith-university',
  'La Trobe University': 'la-trobe-university',
  'Macquarie University': 'macquarie-university',
  'Monash University': 'monash-university',
  'Murdoch University': 'murdoch-university',
  'Queensland University of Technology': 'queensland-university-of-technology',
  'RMIT University': 'rmit-university',
  'Swinburne University of Technology': 'swinburne-university-of-technology',
  'The Australian National University': 'australian-national-university',
  'The University of Melbourne': 'university-of-melbourne',
  'The University of Newcastle': 'university-of-newcastle-australia',
  'The University of Notre Dame Australia': 'university-of-notre-dame-australia',
  'The University of Queensland': 'university-of-queensland',
  'The University of Western Australia': 'university-of-western-australia',
  'University of Canberra': 'university-of-canberra',
  'University of New South Wales': 'university-of-new-south-wales',
  'University of Southern Queensland': 'university-of-southern-queensland',
  'University of Sydney': 'university-of-sydney',
  'University of Tasmania': 'university-of-tasmania',
  'University of Technology Sydney': 'university-of-technology-sydney',
  'University of Wollongong': 'university-of-wollongong',
  'University of the Sunshine Coast': 'university-of-sunshine-coast',
  'Victoria University': 'victoria-university',
  'Western Sydney University': 'western-sydney-university',
};

// Our programme names that differ from the APAC title only in wording
// (hand-checked against the APAC list). ourId -> APAC title.
const APAC_TITLE_ALIASES = {
  'murdoch-university-master-of-applied-psychology-in-clinical-psychology':
    'Master of Applied Psychology Clinical Psychology',
  // UTas course code M7L is the Master of Psychology (Clinical).
  'university-of-tasmania-master-of-psychology-clinical-m7l': 'Master of Psychology (Clinical)',
  // UWA's only clinical neuropsychology master's; APAC lists it as "Master of Clinical Neuropsychology".
  'university-of-western-australia-master-of-psychology-clinical-neuropsychology': 'Master of Clinical Neuropsychology',
};

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ''), r[i] ?? ''])));
}

const norm = (s) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/\(([^)]*)\)/g, ' $1 ').replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|in)\b/g, ' ').replace(/\s+/g, ' ').trim();

function areaOf(title) {
  const t = title.toLowerCase();
  if (t.includes('neuropsych')) return 'clinical neuropsychology';
  if (t.includes('clinical')) return 'clinical';
  if (t.includes('educational')) return 'educational and developmental';
  if (t.includes('organisational')) return 'organisational';
  if (t.includes('forensic')) return 'forensic';
  if (t.includes('health')) return 'health';
  if (t.includes('sport')) return 'sport and exercise';
  if (t.includes('counselling')) return 'counselling psychology';
  return 'applied';
}

const apac = parseCsv(readFileSync(join(SRC, 'raw/apac-full-program-list.csv'), 'utf8'));
const apacActive = apac.filter(
  (r) => r['Study level'] === 'Level 3 - 4' && /^Accreditation (with|without) Conditions$/.test(r['Accreditation status']) &&
    !/doctor of philosophy|\/\s*phd|\bphd\b/i.test(r['Program title']),
);
const apacIndex = new Map(); // institutionId|normTitle -> row
for (const r of apacActive) {
  const inst = APAC_PROVIDERS[r.Provider];
  if (!inst) continue;
  apacIndex.set(`${inst}|${norm(r['Program title'])}`, r);
}

const out = {};
const add = (id, badge) => { (out[id] ??= []).push(badge); };

for (const p of programmes) {
  if (p.discipline !== 'psychology-counselling') continue;
  const title = APAC_TITLE_ALIASES[p.id] ?? p.name;
  const hit = apacIndex.get(`${p.institutionId}|${norm(title)}`);
  if (!hit) continue;
  add(p.id, {
    kind: 'psychology',
    body: 'APAC',
    note: `APAC-accredited 2-year ${areaOf(hit['Program title'])} master's`,
    url: APAC_URL,
  });
}

// ---------------------------------------------------------------------------
// 1b. Psychology — Hong Kong (HKPS Division of Educational Psychology)
// The DEP lists these as the professional training programmes of educational
// psychologists in Hong Kong; its standards make graduates eligible for full
// DEP membership and HKPS registration. Both are 2-year full-time with
// 1,200–1,500 practicum hours. HKPS clinical (DCP) list could not be reached.
// ---------------------------------------------------------------------------
const HKPS_DEP = {
  'university-of-hong-kong-master-of-social-sciences-in-the-field-of-educational-psychology':
    'https://www.dep.hkps.org.hk/professional-training/training-hku/',
  'chinese-university-of-hong-kong-ma-in-professional-educational-psychology':
    'https://www.dep.hkps.org.hk/professional-training/training-cuhk/',
};
for (const [id, url] of Object.entries(HKPS_DEP)) {
  add(id, { kind: 'psychology', body: 'HKPS', note: "HKPS-recognised 2-year educational psychology master's", url });
}

// ---------------------------------------------------------------------------
// 2. Accounting — ISCA Singapore CA Qualification direct-entry degrees.
// Only master's named in the "Direct Entry Degree" list. Overseas degrees only
// gain entry to the Foundation Programme, so they are not badged.
// ---------------------------------------------------------------------------
const ISCA_URL = RULES.accounting.url;
const ISCA_DIRECT = {
  'nanyang-technological-university-singapore-msc-accountancy': 'NTU Master of Science in Accountancy',
  'nanyang-technological-university-singapore-master-of-science-in-accountancy': 'NTU Master of Science in Accountancy',
  'singapore-management-university-master-of-professional-accounting-mpa': 'SMU Master of Professional Accounting',
};
for (const id of Object.keys(ISCA_DIRECT)) {
  add(id, { kind: 'accounting', body: 'ISCA', note: 'Direct-entry degree for the Singapore CA Qualification', url: ISCA_URL });
}

// ---------------------------------------------------------------------------
// 3. Law — SILE scheduled universities whose J.D. is an applicable law degree
// (from the saved SILE page). J.D. conferral cut-offs: Australia on/after
// 1 Dec 2017; US on/after 1 Jan 2004.
// ---------------------------------------------------------------------------
const SILE_JD = {
  'monash-university': 'on or after 1 Dec 2017',
  'university-of-melbourne': 'on or after 1 Dec 2017',
  'university-of-new-south-wales': 'on or after 1 Dec 2017',
  'university-of-sydney': 'on or after 1 Dec 2017',
  'australian-national-university': 'on or after 1 Dec 2017',
  'flinders-university': 'on or after 1 Dec 2017',
  'university-of-queensland': 'on or after 1 Dec 2017',
  'university-of-western-australia': 'on or after 1 Dec 2017',
  'university-of-tasmania': 'on or after 1 Dec 2017',
  'murdoch-university': 'on or after 1 Dec 2017',
  'harvard-university': 'on or after 1 Jan 2004',
  'columbia-university': 'on or after 1 Jan 2004',
  'new-york-university': 'on or after 1 Jan 2004',
  'university-of-michigan-ann-arbor': 'on or after 1 Jan 2004',
  'university-of-michigan': 'on or after 1 Jan 2004',
};
const isJD = (p) => p.degreeType === 'JD' || /juris\s*doctor|doctor of jurisprudence|\bJ\.?D\b/i.test(p.name);
const jdProgrammes = programmes.filter(isJD);
for (const p of jdProgrammes) {
  const cutoff = SILE_JD[p.institutionId];
  if (!cutoff) continue;
  add(p.id, { kind: 'law', body: 'SILE', note: `SILE-scheduled J.D., conferred ${cutoff}, top 70%`, url: RULES.law.url });
}

// ---------------------------------------------------------------------------
const known = new Set(programmes.map((p) => p.id));
for (const id of Object.keys(out)) if (!known.has(id)) throw new Error(`Unknown programme id: ${id}`);

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(
  join(ROOT, 'data/raw/professional-badges.json'),
  JSON.stringify({ checked: CHECKED, rules: RULES, programmes: sorted }, null, 2) + '\n',
);

const counts = {};
for (const list of Object.values(sorted)) for (const b of list) counts[`${b.kind}/${b.body}`] = (counts[`${b.kind}/${b.body}`] ?? 0) + 1;
console.log('programmes badged:', Object.keys(sorted).length, counts);
console.log('JD programmes checked:', jdProgrammes.length);
