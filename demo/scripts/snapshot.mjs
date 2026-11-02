// Builds public/data/programmes.json from the live site's programme file (or a saved copy of it):
// the programmes with reported admits, trimmed to the fields the demo shows.
//
//   npm run data:snapshot                     (reads https://kaplan360pp-v201.netlify.app/data/programmes)
//   npm run data:snapshot -- path/to/file.json

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SOURCE = process.argv[2] ?? "https://kaplan360pp-v201.netlify.app/data/programmes"
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "programmes.json")

const raw = SOURCE.startsWith("http")
  ? await (await fetch(SOURCE)).json()
  : JSON.parse(await readFile(SOURCE, "utf8"))

const spread = (s) =>
  s ? { n: s.n, p10: s.p10, p25: s.p25, median: s.median, p75: s.p75, p90: s.p90 } : null

/** An English-taught degree from Singapore counts instead of a test score. */
const waiver = (rule) =>
  rule?.required === "unless-exempt" &&
  !!rule.exemption &&
  (rule.exemption.countries.length === 0 ||
    rule.exemption.countries.some((c) => /singapore/i.test(c)))

const kept = raw.programmes.filter((p) => p.cases && p.cases.n > 0)
const uniIndex = new Map()
const universities = []
for (const p of kept) {
  if (uniIndex.has(p.u)) continue
  const u = raw.universities[p.u]
  uniIndex.set(p.u, universities.length)
  universities.push({ name: u.name, country: u.country, qs: u.qsValue ?? null, partner: u.partner })
}

const programmes = kept.map((p) => {
  const c = p.cases
  return {
    id: p.id,
    u: uniIndex.get(p.u),
    name: p.name,
    discipline: p.discipline,
    any: p.any,
    months: p.months,
    intake: p.intake,
    feeSgd: p.feeSgd === null ? null : Math.round(p.feeSgd / 100) * 100,
    feeBasis: p.feeBasis,
    ielts: p.ielts,
    toefl: p.toefl,
    gre: p.gre?.status ?? null,
    gmat: p.gmat?.status ?? null,
    waiver: waiver(p.englishRule),
    minBasis: p.minBasis,
    work: p.work,
    mode: p.mode,
    url: p.url,
    checked: p.checked,
    cases: {
      n: c.n,
      years: c.years,
      gpa: spread(c.gpa),
      ielts: spread(c.ielts),
      toefl: c.toefl?.median ?? null,
      gre: c.gre?.median ?? null,
      gmat: c.gmat?.median ?? null,
      mix: c.mix,
      status: { fresh: c.status.fresh, graduated: c.status.graduated, working: c.status.working, other: c.status.other },
      experience: c.experience
        ? {
            sampled: c.experience.sampled,
            internship: c.experience.internship,
            research: c.experience.research,
            competition: c.experience.competition,
            work: c.experience.work,
            project: c.experience.project,
          }
        : null,
      rejected: c.rejected?.n ?? 0,
      flags: c.flags,
      sources: Object.fromEntries(Object.entries(c.sources).filter(([, n]) => n > 0)),
    },
  }
})

const dataset = {
  builtAt: raw.builtAt,
  fx: raw.fx,
  sources: raw.cases.sources,
  universities,
  programmes,
}

await mkdir(path.dirname(OUT), { recursive: true })
const json = JSON.stringify(dataset)
await writeFile(OUT, json)

const byCountry = {}
for (const p of programmes) byCountry[universities[p.u].country] = (byCountry[universities[p.u].country] ?? 0) + 1
console.log(`${programmes.length} programmes, ${universities.length} universities, ${(json.length / 1024).toFixed(0)} KB`)
console.log(byCountry)
console.log(`English waiver for a Singapore degree: ${programmes.filter((p) => p.waiver).length}`)
