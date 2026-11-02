// Programme catalogues for the Hong Kong, Macau and Singapore focus (decided 2026-10-20): each
// university's official taught-postgraduate list, read from its seed pages and, where the list is
// split by faculty, one or two hub levels below. Pages are read politely (robots.txt, pacing), in a
// real browser where a site needs one. Writes scripts/pipeline/lists/asia/<id>.json, which
// sources.ts uses as that university's programme pages.
// Usage: npx tsx scripts/pipeline/asia-catalogue.ts [--only=city-university-of-hong-kong]

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { closeBrowser } from "./browser";
import { paginatedListing, politeFetch, routeThroughBrowser } from "./http";
import { args } from "./util";

export type Catalogue = {
  id: string;
  seeds: string[];
  /** Hub pages to open (faculty or department lists), matched against the full URL. */
  follow?: string;
  /** Programme pages to keep, matched against the full URL. */
  keep: string;
  exclude?: string;
  /** Hub levels below the seeds (default 1 when `follow` is set). */
  depth?: number;
  browser?: boolean;
  /** With `browser`: the seeds page by script; this selector is their "next" control, clicked until done. */
  listingNext?: string;
  /** Programme pages differ only by query string (HKU's "programme-details?programme=…"). */
  keepQuery?: boolean;
  /** Programme pages listed by hand (from an official list that has no links, e.g. a PDF). */
  pages?: string[];
};

const RESEARCH = "phd|mphil|doctor|doctoral|research-postgraduate|\\brpg\\b|/rpg/|engd|dba\\b|edd\\b";

export const CATALOGUES: Catalogue[] = [
  {
    id: "city-university-of-hong-kong",
    seeds: ["https://www.cityu.edu.hk/en/pg/taught-postgraduate-programmes/list"],
    keep: "cityu\\.edu\\.hk/en/pg/programme/program-list/2027/",
    browser: true,
  },
  {
    id: "macao-polytechnic-university",
    seeds: ["https://mpusite.mpu.edu.mo/postgraduate/en/master_list.php"],
    keep: "mpu\\.edu\\.mo/[a-z]+/en/master_[a-z0-9_]+\\.php$",
    browser: true,
  },
  // NUS: the AY2026/27 Bulletin's coursework page for each faculty links to the faculty's own
  // programme pages (fass.nus.edu.sg/ecs/master-of-economics/ …). Computing, ISS and Law list their
  // master's on their own sites (checked 2026-10-22), so those lists are seeds too.
  {
    id: "national-university-of-singapore",
    seeds: [
      ...[
        "faculty-of-arts-and-social-sciences", "school-of-business", "school-of-computing", "school-of-continuing-lifelong-education", "faculty-of-dentistry",
        "college-of-design-and-engineering", "college-of-humanities-and-sciences", "nus-graduate-school", "faculty-of-law", "yong-loo-lin-school-of-medicine-including-nursing",
        "yong-siew-toh-conservatory-of-music", "saw-swee-hock-school-of-public-health", "lee-kuan-yew-school-of-public-policy", "faculty-of-science", "institute-of-systems-science",
      ].map((f) => `https://www.nus.edu.sg/nusbulletin/ay202627/programmes/${f}/graduate-education/coursework-programmes/`),
      "https://www.comp.nus.edu.sg/programmes/",
      "https://www.iss.nus.edu.sg/graduate-programmes",
      "https://law1a.nus.edu.sg/admissions/coursework_deg.html",
    ],
    keep: [
      "^https?://(?!www\\.nus\\.edu\\.sg/(nusbulletin|registrar|privacy|alumnet|staff|nuslibraries))[a-z0-9.-]*nus\\.edu\\.sg/.*(master|msc|m-sc|mba|/ma-|llm|mpa|mpp|mph|mtech|m-tech|coursework|programmes/graduate|msocsci)",
      "comp\\.nus\\.edu\\.sg/programmes/pg/(mcomp-[a-z]+|mdft|mcs|mis|misc|mai)/?$",
      "math\\.nus\\.edu\\.sg/(ms-dsml-v1|pg/mqf)/?$",
      "tliap\\.nus\\.edu\\.sg/education/curriculum/?$",
    ].join("|"),
    exclude:
      "graduate-diploma|gdip|admission-requirements|programme-requirements|frequently-asked|faq|coursework_deg|/cems-mim|mfe-program/introduction|double-degree|" +
      "professional-diploma|graduate-programmes/graduate-programmes|alumni-companies|wp-content|master-of-social-work-by-coursework|\\.(pdf|css|js)(\\?|$)|www\\.nus\\.edu\\.sg/prog/",
    // The Business School's master's each have their own site (listed on mscbiz.nus.edu.sg, 2026-10-22):
    // the home page, its admission requirements and its fees. The Financial Engineering programme (RMI) likewise.
    pages: [
      ...["mscacc", "mscfin", "msgfin", "mschcma", "mim", "mscmarketing", "mscre", "mscstrategy"].flatMap((h) => [
        `https://${h}.nus.edu.sg`,
        `https://${h}.nus.edu.sg/admissions/${h === "mscstrategy" ? "nus-msi-admission-requirements" : "admission-requirements"}`,
        `https://${h}.nus.edu.sg/fees-finances/programme-fees`,
      ]),
      "https://emim.nus.edu.sg", "https://emim.nus.edu.sg/admissions-finance",
      "https://mba.nus.edu.sg", "https://mba.nus.edu.sg/admissions-and-funding",
      "https://rmi.nus.edu.sg/mfe-program", "https://rmi.nus.edu.sg/mfe-program/admission", "https://rmi.nus.edu.sg/mfe-program/tuition-fee",
      // The Bulletin still links the Master of Social Work's old address, which returns 404.
      "https://fass.nus.edu.sg/swk/master-of-social-work-coursework",
    ],
    browser: true,
  },
  // HKU: the admissions portal lists each faculty's programmes ten at a time (2026-10-22); its sitemap has
  // only part of them (93 of the programmes).
  {
    id: "university-of-hong-kong",
    seeds: [
      "faculty-of-architecture", "faculty-of-arts", "faculty-of-dentistry", "faculty-of-education", "faculty-of-engineering", "faculty-of-law",
      "faculty-of-science", "faculty-of-social-sciences", "hku-business-school", "lks-faculty-of-medicine", "school-of-computing-and-data-science",
      "school-of-governance-and-policy", "school-of-innovation",
    ].map((f) => `https://portal.hku.hk/tpg-admissions/programme-listing?faculty=${f}`),
    keep: "portal\\.hku\\.hk/tpg-admissions/programme-details\\?programme=[a-z0-9(]",
    exclude: "postgraduate-diploma|postgraduate-certificate|executive-master|\\$\\{",
    listingNext: "li.paginationjs-next:not(.disabled)",
    keepQuery: true,
    browser: true,
  },
  // HKUST: the 2027-28 programme catalogue (published by 2026-10-22; the sitemap still lists 2026-27).
  {
    id: "hong-kong-university-of-science-and-technology",
    seeds: ["https://prog-crs.hkust.edu.hk/pgprog/2027-28"],
    keep: "prog-crs\\.hkust\\.edu\\.hk/pgprog/2027-28/(msc|ma|meng|mpm|mpp|pgd|ft-pt-mba|pt-mba)[a-z-]*/?$",
    exclude: "emba",
    browser: true,
  },
  {
    id: "hong-kong-baptist-university",
    seeds: ["https://ar.hkbu.edu.hk/tpg-admissions/programmes"],
    keep: "ar\\.hkbu\\.edu\\.hk/tpg-admissions/programmes/[a-z]",
    exclude: "zhuhai|doctor-of|executive-master",
    browser: true,
  },
  // UM: the Graduate School's page links to each faculty's master's pages.
  {
    id: "university-of-macau",
    seeds: ["https://grs.um.edu.mo/index.php/prospective-students/master-postgraduate-certificate-diploma-programmes"],
    keep: "^https?://(?!grs\\.)[a-z0-9.-]+\\.um\\.edu\\.mo/.*(master|msc|m-s-in|/pgraduate/[a-z]+|masters-program|postgraduate-study/master|programmes/master|/master/?$)|mscfin\\.fba\\.um\\.edu\\.mo",
    exclude: "philosophy-in|course-study-plan-mphil|postgraduate-diploma|pgce|specialization/?$|introduction-to-macau-law",
    browser: true,
  },
  // EdUHK: the Graduate School's list links to six faculty sites; the Chinese (zht) copies are left out.
  {
    id: "education-university-of-hong-kong",
    seeds: ["https://gs.eduhk.hk/pg-programmes/"],
    keep: "eduhk\\.hk/.*(academic-programmes/[A-Za-z]|postgraduate-programmes/master|postgraduate-programme/master|/programmes/(master|ma|stem)|programmes\\.php\\?id=|/prospective/med/?$)",
    exclude: "/zht/|coming-soon|how_to_apply|programme-information",
    browser: true,
  },
  // HSUHK: programmes on offer link to each programme's own page or site.
  {
    id: "hang-seng-university-of-hong-kong",
    seeds: ["https://gs.hsu.edu.hk/en/programmes-on-offer/", "https://gs.hsu.edu.hk/en/postgraduate-programmes-on-offer/", "https://www.hsu.edu.hk/en/academic-programmes/postgraduate/"],
    keep: "^https?://(aad|dsai|elta|gelcs|gscm|mats|msi|scm|programme|ecampus|machi|dda)\\.hsu\\.edu\\.hk/.+|^https?://(sbus|scom|stfl)\\.hsu\\.edu\\.hk/.*(master|prog/|postgraduate-programmes/|programmes/)",
    exclude: "/cn/|/hk/|/zh|wp-content|feed|undergraduate|bachelor|giving|%20$",
    browser: true,
  },
  // Lingnan: the Graduate School's nine programmes have their own sites (/sgs/<code>); the faculties list theirs.
  {
    id: "lingnan-university-hong-kong",
    seeds: [
      "https://www.ln.edu.hk/academics/faculty-of-business",
      "https://www.ln.edu.hk/academics/faculty-of-arts",
      "https://www.ln.edu.hk/academics/faculty-of-social-sciences",
      "https://www.ln.edu.hk/fb/tpg/home",
      "https://www.ln.edu.hk/socsc/postgraduate-programme",
      "https://www.ln.edu.hk/chi/course/postgraduate",
      "https://www.ln.edu.hk/tran/programmes/",
    ],
    keep: "ln\\.edu\\.hk/(fb/tpo/academic-programmes/[a-z]+|sgs/(ihem|cpa|crds|mcg|achm|ham|mhsm|sag|seim)(/home)?$|cultural/programmes/mcs|socsc/.*(master|msocsc|msc|/ma)|chi/course/postgraduate/.+|tran/programmes/(ma|mat|master).*)",
    exclude: "/chs/|/cht/",
    pages: ["ihem", "cpa", "crds", "mcg", "achm", "ham", "mhsm", "sag/home", "seim"].map((c) => `https://www.ln.edu.hk/sgs/${c}`),
  },
  {
    id: "hong-kong-shue-yan-university",
    seeds: ["https://gs.hksyu.edu/en/Programmes/TaughtMasterProgramme"],
    keep: "gs\\.hksyu\\.edu/en/Programmes/TaughtMasterProgramme/.+",
  },
  // MUST: the Graduate School's master's list links to each faculty's programme pages.
  {
    id: "macau-university-of-science-and-technology",
    seeds: ["https://www.must.edu.mo/en/sgs/admission/master"],
    keep: "must\\.edu\\.mo/(en/[a-z]+(/[a-z]+)?/(programme|course)/.+|programmes/program/view/id-\\d+\\.html)",
    exclude: "/cn/|/pt/|emba|/other/",
    browser: true,
  },
  // UTM: two schools list their postgraduate programmes; the admission pages describe the master's degrees.
  {
    id: "macao-university-of-tourism",
    seeds: ["https://www.utm.edu.mo/shm/en/programmes/postgraduate-programmes/index.html", "https://www.utm.edu.mo/stm/en/programmes/postgraduate-programmes/index.html"],
    keep: "utm\\.edu\\.mo/(shm|stm)/en/programmes/.*(master|postgraduate-programmes/.+)",
    exclude: "/tc/|/sc/|/pt/|doctor|bachelor",
    pages: ["https://www.utm.edu.mo/admission/en/postgraduate_programmes/master-degree/index.html", "https://www.utm.edu.mo/admission/en/postgraduate_programmes/study-plan-and-course-description/index.html"],
    browser: true,
  },
  // City University of Macau: the master's list links to each faculty's programme page (2026-10-22).
  {
    id: "city-university-of-macau",
    seeds: ["https://www.cityu.edu.mo/en/admissions/masters-degree-progammes/"],
    keep:
      "^https?://(fob|fds|fof|fhss|fhw|fiad|fitm|soe|sol|iropc|iusd)\\.cityu\\.edu\\.mo/" +
      "(en/master/\\d+|en/MastersProgramme|en/page-\\d+|en/list-\\d+/\\d+|list-\\d+/\\d+|en/masterofscience[a-z]+|en/(Master|MA)-[A-Za-z-]+|course/\\d+|en/Course-2/\\d+|en/courses/\\d+|en/mfa|Application2)/?$",
    exclude: "mphil",
    browser: true,
  },
  // HKMU: the admissions list (rendered by script) links to each school's programme pages.
  {
    id: "hong-kong-metropolitan-university",
    seeds: ["https://admissions.hkmu.edu.hk/tpg/programmes/"],
    keep: "hkmu\\.edu\\.hk/(as/programmes-courses/tpg/[a-z]+|ba/[a-z]+f?|el/programmes-courses/(postgraduate|postgraduate-2|taught-postgraduate)/(m|ma|med|msc)[a-z]+|nhs/programmes-courses/.*master.*|st/.*(master|msc|masc|mcomp).*|physio/programmes/taught-postgraduate-programmes)",
    exclude: "pgd|/dl/|/ug/|/rpg/|webmaster",
    browser: true,
  },
  // Kaplan Singapore's own master's, taught with partner universities (www.kaplan.com.sg/sitemap.xml,
  // 2026-10-20). Graduate certificates and diplomas, the DBA and e-learning versions are left out.
  {
    id: "kaplan-higher-education-academy",
    seeds: [],
    keep: "$^",
    pages: [
      "double-masters-master-of-business-administration-master-of-human-resources-management", "master-of-business-administration-mu", "master-of-business-administration-nu",
      "master-of-counselling", "master-of-counselling-mu", "master-of-education-digital-learning", "master-of-education-inclusive-and-special-needs-education",
      "master-of-education-international-education", "master-of-laws-in-international-business-law", "master-of-professional-accounting", "master-of-public-health",
      "master-of-science-ai-artificial-intelligence-and-machine-learning", "master-of-science-cyber-security-and-forensic-information-technology", "master-of-science-data-analytics",
      "master-of-science-digital-marketing-and-strategy", "master-of-science-engineering-business-management", "master-of-science-global-finance",
      "master-of-science-in-healthcare-leadership-and-management", "master-of-science-in-information-technology-data-science-artificial-intelligence",
      "master-of-science-in-information-technology-information-technology-management", "master-of-science-in-psychology", "master-of-science-management",
      "master-of-science-strategic-business-analytics", "master-of-science-strategic-financial-management", "master-of-science-strategic-supply-chain-management",
    ].map((s) => `https://www.kaplan.com.sg/postgraduate-degree/${s}`),
  },
];

async function collect(c: Catalogue): Promise<string[]> {
  const keep = new RegExp(c.keep, "i");
  const follow = c.follow ? new RegExp(c.follow, "i") : null;
  const exclude = new RegExp([RESEARCH, c.exclude].filter(Boolean).join("|"), "i");
  const found = new Set<string>(c.pages ?? []);
  const seen = new Set<string>();
  let level = [...c.seeds];
  const depth = c.depth ?? (follow ? 1 : 0);
  for (let d = 0; d <= depth && level.length; d++) {
    const next: string[] = [];
    for (const url of level) {
      if (seen.has(url)) continue;
      seen.add(url);
      const r = c.listingNext && d === 0 ? await paginatedListing(url, c.listingNext) : await politeFetch(url);
      if (!r.ok) {
        console.log(`  ${url}: ${r.reason} ${r.detail}`);
        continue;
      }
      const html = "pages" in r ? r.pages.join("\n") : r.body.toString("utf8");
      const base = "pages" in r ? url : r.finalUrl;
      for (const m of html.matchAll(/href\s*=\s*["']([^"'#\s]+)["']/gi)) {
        let u: string;
        try {
          u = new URL(m[1].replace(/&amp;/g, "&"), base).toString();
        } catch {
          continue;
        }
        if (exclude.test(u)) continue;
        if (keep.test(u)) found.add(u.replace(/\/$/, ""));
        else if (follow?.test(u) && !seen.has(u)) next.push(u);
      }
    }
    level = [...new Set(next)];
  }
  return [...found].sort();
}

async function main() {
  const a = args();
  const list = CATALOGUES.filter((c) => !a.only || a.only.includes(c.id));
  routeThroughBrowser(list.filter((c) => c.browser).flatMap((c) => c.seeds.map((s) => new URL(s).origin)));
  const dir = path.join(import.meta.dirname, "lists", "asia");
  mkdirSync(dir, { recursive: true });
  for (const c of list) {
    const pages = await collect(c);
    writeFileSync(path.join(dir, `${c.id}.json`), JSON.stringify({ id: c.id, builtAt: new Date().toISOString().slice(0, 10), seeds: c.seeds, pages }, null, 2) + "\n");
    console.log(`${c.id}: ${pages.length} programme pages`);
  }
  await closeBrowser();
}

if (process.argv[1]?.endsWith("asia-catalogue.ts")) main();
