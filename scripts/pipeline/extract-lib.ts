import { parseDurationMonths } from "../../lib/pipeline/duration";
import { academicStructured, admissionTest, englishScores, englishTestScore, TEST_NAMES, type AdmissionTest } from "../../lib/pipeline/requirements";
import type { AcademicStructured, Currency, Discipline, EnglishScores } from "../../lib/pipeline/types";

// Rule-based extraction of programme details from an official page's text. Every value is either
// quoted from the page (with the line it came from kept as evidence) or read directly from such a
// quote (numbers, classification). Nothing is inferred beyond the text: a value that can't be found
// stays null, and the record is flagged for review when a required value is missing.

export type Evidence = { text: string; url: string };

export type Extracted = {
  name: string | null;
  degreeType: string | null;
  discipline: Discipline | null;
  /** The entry requirement accepts a bachelor's in any subject (conversion programme). */
  acceptsAnyBackground: boolean;
  academic: string | null;
  academicStructured: AcademicStructured | null;
  background: string | null;
  english: string | null;
  englishScores: EnglishScores | null;
  /** Other tests the page names: minimum scores (TOEFL iBT, PTE Academic, Duolingo) and whether GRE / GMAT are asked for. */
  tests: Tests;
  duration: string | null;
  intake: string | null;
  deadline: string | null;
  tuition: { amount: number; currency: Currency; basis: string } | null;
  evidence: Record<string, Evidence>;
  notes: string[];
};

// ---------- HTML → lines of text ----------

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…", pound: "£", euro: "€", bull: "•", middot: "·", times: "×", eacute: "é",
  egrave: "è", ouml: "ö", uuml: "ü", auml: "ä", ge: "≥", le: "≤", shy: "",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export type Page = { url: string; html: string };

export type PageText = { url: string; title: string | null; ogTitle: string | null; h1: string[]; lines: string[] };

export function pageText(page: Page): PageText {
  let html = page.html;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i.exec(html)?.[1];
  html = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, " ");
  const h1 = Array.from(html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi), (m) => clean(m[1])).filter(Boolean);
  const text = html
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|th|table|section|article|dt|dd|dl|header|main|aside|blockquote|summary|details|figcaption|label|button|option)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decodeEntities(text)
    .split("\n")
    // Markup that survived inside attributes (e.g. Murdoch's tooltip HTML) is not page text.
    .map((l) => l.replace(/<\/?[a-z][^>]*>/gi, " ").replace(/\s+/g, " ").trim())
    // A single digit can be a value (Murdoch: <dt>Full time duration</dt><dd>2</dd>).
    .filter((l) => (l.length > 1 || /\d/.test(l)) && !/^["'>\s/]*$/.test(l));
  return { url: page.url, title: title ? clean(title) : null, ogTitle: og ? clean(og) : null, h1, lines };
}

// ---------- Name, degree and field ----------

const DEGREE =
  /\b(MSc|M\.Sc\.?|MA|M\.A\.|MCom|MFin|MMgt|MIM|MSBA|MSF|MQM|MMS|MSM|MLitt|MS|MBA|MRes|MPhil|LLM|MEng|MEd|MPH|MPA|MPP|Master of [A-Z][A-Za-z&,'’ ]{2,70}|Masters? in [A-Z][A-Za-z&,'’ ]{2,70}|Master(?:['’]s)? (?:[Dd]egree )?[Pp]rogram(?:me)? in [A-Z][A-Za-z&,'’ ]{2,70}|Master['’]s (?:[Dd]egree )?in [A-Z][A-Za-z&,'’ ]{2,70})/;
// ("Master's Degree in …" (UAB), "Master's Programme in …" (Uppsala, Stockholm, Oslo), "Master's Degree Programme
// in …" (Turku), "Master Degree Program in …" (NOVA): the European forms, added 2026-11-01.)
/** Research and executive degrees are left out; MBA, LLM, MEd and MPH stay (they match Kaplan degrees). */
const EXCLUDED_DEGREE = /^(MRes|MPhil)$|Executive|Research|Philosophy/i;
const SITE_SUFFIX = /\s*[|–—-]\s*(?:[^|–—-]*\b(University|College|School|Institute|UCL|LSE|UNSW|NTU|NUS|Imperial|Study)\b[^|–—-]*|Postgraduate[^|–—-]*|Courses?[^|–—-]*)$/i;

/** A programme code with its sub-codes ("09003-MCF-MCP-…-MSF-MSP", PolyU): never a name, though "MSF" reads as a degree. */
const CODE_LIST = /^\s*\d{3,6}(?:-[A-Z]{2,4}){2,}\s*$/;

export function degreeOf(text: string): string | null {
  if (CODE_LIST.test(text)) return null;
  const m = DEGREE.exec(text);
  if (!m) return null;
  const d = m[1].replace(/\./g, "");
  if (/^Master/i.test(d)) return d.replace(/\s+/g, " ").trim().replace(/[,;:]+$/, "");
  return d === "MSc" || d === "MA" || d === "MS" ? d : d.toUpperCase() === "MSC" ? "MSc" : d;
}

function degreeType(d: string): string {
  if (/^(MSBA|MSF|MQM|MMS|MSM)$/.test(d)) return "MS";
  if (/^Master of Science|^MSc$|^MS$/i.test(d)) return /^MS$/.test(d) ? "MS" : "MSc";
  if (/^Master of Arts|^MA$/i.test(d)) return "MA";
  if (/^Master of Commerce|^MCom$/i.test(d)) return "MCom";
  if (/^Master of Finance|^MFin$/i.test(d)) return "MFin";
  if (/^Master of Management|^MMgt$/i.test(d)) return "MMgt";
  if (/^Masters? in|^Master(?:['’]s)? (?:degree )?(?:program(?:me)? )?in/i.test(d)) return "Master's";
  if (/^Master of/i.test(d)) return "Master's";
  return d;
}

/** Left out: double degrees, part-time and research degrees. (Programmes at a campus abroad are kept as their own entries, see campusOf.) */
const DOUBLE_OR_RESEARCH = /\bdual\b|double degree|\bDDM\b|master\b.*\bmaster\b|part[- ]?time|\b(MPhil|MRes)\b|\bby research\b|\(research\)|advanced master/i;

/** Places of campuses abroad and partner schools, as programme names give them in brackets, with the roster's country names. */
export const CAMPUS_COUNTRY: Record<string, string> = {
  dubai: "United Arab Emirates", malaysia: "Malaysia", china: "China (Mainland)", ningbo: "China (Mainland)", suzhou: "China (Mainland)",
  shanghai: "China (Mainland)", beijing: "China (Mainland)", singapore: "Singapore", mauritius: "Mauritius", "sri lanka": "Sri Lanka",
  india: "India", qatar: "Qatar", egypt: "Egypt", vietnam: "Vietnam", indonesia: "Indonesia", bhutan: "Bhutan", nepal: "Nepal",
  myanmar: "Myanmar", cambodia: "Cambodia", thailand: "Thailand", philippines: "Philippines", kazakhstan: "Kazakhstan",
  uzbekistan: "Uzbekistan", oman: "Oman", bahrain: "Bahrain", kuwait: "Kuwait", nigeria: "Nigeria", kenya: "Kenya", ghana: "Ghana",
  pakistan: "Pakistan", bangladesh: "Bangladesh",
};
const CAMPUS = new RegExp(`\\s*\\((?:(?:taught|offered|delivered)\\s+)?(?:(?:in|at)\\s+)?(?:([A-Z][\\w&.'-]*),?\\s+)?(${Object.keys(CAMPUS_COUNTRY).join("|")})\\)`, "i");

/**
 * Where a name places the programme, in brackets: "Data Science (Dubai) MSc", "Master of Public Health (Kaplan, Singapore)",
 * "MSc Finance (QFBA, Qatar)", "… (offered in Shanghai)". A subject is not a place: "(Contemporary China Studies)".
 * `bracket` is the text to take out of the name to compare it with the home campus's programme.
 */
export function campusOf(name: string): { place: string; partner: string | null; bracket: string } | null {
  const m = CAMPUS.exec(name);
  return m ? { place: m[2].toLowerCase(), partner: m[1] ?? null, bracket: m[0] } : null;
}

/** Pages about something other than the programme itself: events, webinars, single courses (modules). */
const NOT_A_PROGRAMME =
  /\b(info(rmation)? sessions?|webinars?|open (day|evening)s?|course\s*[-–—]|courses\b|scholarships?|alumni|stories|blog|news|admissions|academics|fees|financing|financial aid|faqs?|frequently asked questions|curriculum|electives|careers?|class profile|tuition)\b/i;

function tidyName(raw: string): string {
  const tidied = raw
    .replace(SITE_SUFFIX, "")
    .replace(SITE_SUFFIX, "")
    .replace(/[–—-]?\s*\b20\d\d(\/\d\d(\d\d)?)?\s+entry\b/gi, " ")
    // Northumbria: "Finance MSc 1 Year Full-Time | September Start" → "Finance MSc" (part-time stays, to be excluded).
    .replace(/\s+\d{1,2}(\.\d)?\s+(months?|years?),?\s+full[- ]time\s*(\|\s*[A-Za-z]+\s+start)?\s*$/i, "")
    .replace(/\s*[–—]\s*$/, "")
    // PolyU: "24043 - Master of Science in …", "54057-FT-PT - Master of …" (the programme code first).
    .replace(/^\s*\d{4,6}(-[A-Z]{2,4})*\s+[–—-]\s+/, "")
    // Stanford Bulletin: "CS-MS - Computer Science (MS)" (the program code first).
    .replace(/^\s*[A-Z]{2,6}-[A-Z]{2,6}\s+[–—-]\s+/, "")
    // UChicago: "Degrees: Master of Laws".
    .replace(/^\s*(degrees?|programs?|programmes?)\s*:\s*/i, "")
    // NUS: "Department of Mathematics - MSc in Data Sci. and Machine Learning" (the department first).
    .replace(/^\s*(Department|School|Faculty|Institute|Centre|Center) of [^–—|-]+\s+[–—|-]\s+/, "")
    // NUS Business School: "The NUS MS<span>c</span> in Finance" reads "The NUS MS c in Finance".
    .replace(/\bMS c\b/g, "MSc")
    .replace(/^\s*(?:(?:The|THE)\s+)?NUS\s+(?=(MSc|MBA|Master)\b)/, "")
    // "Strategic Analysis and Innovation(MSI)", "MSc(Top up)".
    .replace(/([a-z])\((?=[A-Z])/g, "$1 (")
    // Canberra: "Master of Professional Accounting (297JA.4)" (the course code and version).
    .replace(/\s*\((?=[A-Z0-9]*\d)[A-Z0-9]{4,8}\.\d{1,2}\)\s*$/, "")
    // Griffith: "Master of Business - 5632" (the course code last).
    .replace(/\s+[–—-]\s+\d{4,5}$/, "")
    // Salford: "MSc MSc Sport Rehabilitation …" (the award twice).
    .replace(/\b(MSc|MA|MBA|LLM|MPH|MEd|MRes)\s+\1\b/g, "$1")
    // "MSc Data Science (Conversion)" rather than "MSc — Data Science (Conversion)"; "Education - MA" (BCU) → "Education MA".
    .replace(/^(MSc|MA|MCom|MFin)\s*[–—-]\s*/, "$1 ")
    .replace(/\s+[–—-]\s+(MSc|MA|MBA|LLM|MRes|MPH|MEd|MFA|MArch|MPA)$/, " $1")
    // City University of Macau: "… - Faculty of Data Science", "… - 澳門城巿大學 國際旅遊與管理學院" (the faculty last).
    .replace(/\s+[–—-]\s+(Faculty|School|College|Institute) of [^–—|-]+$/, "")
    .replace(/\s+[–—-]\s+[㐀-鿿][^A-Za-z]*$/, "")
    .replace(/^\s*[–—-]\s*/, "")
    // Warsaw: "… – Global MBA, full-time, second cycle"; CEU: "Master of Arts in International Relations 2 Years" (2026-11-01).
    .replace(/,\s*full[- ]time(,\s*(first|second)[- ]cycle)?\s*$/i, "")
    // Universitas Indonesia: "About Master Program in Communication", "… – Fakultas Ekonomi dan Bisnis Universitas Indonesia".
    .replace(/^About\s+(?=Master)/, "")
    // Stuttgart: "Computer Science M.Sc. for prospective students"; a breadcrumb first ("Home / Programs / …").
    .replace(/\s+for (prospective|international|future) students\s*$/i, "")
    // Navarra: "MBA ."; Goethe: "Goethe Business School: Master in Finance"; Stony Brook: "Full-Time MA in Higher Education
    // Administration" (2026-11-01). ("(1 Year)" stays: it tells a one-year track from a two-year one, CEU, Heriot-Watt.)
    .replace(/\s+\.\s*$/, "")
    .replace(/^[A-Z][\w&.'’ -]{2,60}\b(Business|Management|Law|Graduate) School\s*[:–—|-]\s+(?=Master|MSc|MBA|MA\b|LLM)/, "")
    .replace(/^(Full|Part)[- ]Time\s+(?=Master|MSc|MBA|MA\b|MS\b|LLM|MEd|MPH)/i, "")
    .replace(/^Home\s*\/\s*(?:[^/]+\/\s*)*/i, "")
    .replace(/\s+[–—-]\s+(Fakultas|Facultad|Faculté|Fakultät|Facoltà|Faculdade)\b.*$/i, "")
    .replace(/\s+\d(\.\d)?\s+years?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return unshout(tidied);
}

const ABBREVIATIONS = [
  "MSc", "MBA", "EMBA", "MA", "MS", "LLM", "MPH", "MRes", "MEd", "MFA", "MSocSc", "MSSc", "MPhil", "MArch", "MEng", "MBus", "MCom", "MFin",
  "MPA", "MPP", "MSW", "MIM", "PGCert", "PGDip", "CPD", "UK", "AI", "IT", "HR", "NHS", "BIM", "ESG",
];
/** Short words in capitals that are words, not acronyms ("INTERNATIONAL LAW"); other short ones stay ("NUS", "UCL"). */
const SHORT_WORDS = /^(in|of|and|the|for|with|to|on|at|by|law|art|new|web|sea|air|oil|gas|age|use|big|key|tax|spa)$/i;

/** Words in capitals ("POST REGISTRATION IN CHILDREN'S NURSING PgDip; MSc", "MSc IN REAL ESTATE") in title case,
 * when a name has two or more long ones; abbreviations, dotted ones ("B.A./M.A.") and acronyms stay. */
function unshout(s: string): string {
  const words = s.split(" ");
  const bareOf = (w: string) => w.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const shouted = (w: string) => {
    const bare = bareOf(w);
    return !w.includes(".") && bare.length >= 2 && bare === bare.toUpperCase() && bare !== bare.toLowerCase();
  };
  if (words.filter((w) => shouted(w) && bareOf(w).length >= 4 && !ABBREVIATIONS.some((a) => a.toLowerCase() === bareOf(w).toLowerCase())).length < 2) return s;
  return words
    .map((w, i) => {
      const bare = bareOf(w);
      const abbreviation = ABBREVIATIONS.find((a) => a.toLowerCase() === bare.toLowerCase());
      if (abbreviation) return w.replace(bare, abbreviation);
      if (!shouted(w)) return w;
      if (bare.length <= 3 && !SHORT_WORDS.test(bare)) return w;
      if (i > 0 && /^(in|of|and|the|for|with|to|on|at|by)$/i.test(bare)) return w.toLowerCase();
      // The first letter, not the first character: "(RIGHTS" → "(Rights".
      return w.toLowerCase().replace(/[a-zà-ÿ]/, (c) => c.toUpperCase());
    })
    .join(" ");
}

/** The programme's name as the page gives it, and its degree type. */
export function nameAndDegree(pages: PageText[]): { name: string | null; degreeType: string | null; excluded: boolean } {
  // A page whose address names the programme ("…/Master%20of%20Social%20Work", "…/MasterofSocialSciencesinPsychology")
  // and repeats that name as a line: that line is the name, even when menus list other programmes first (Shue Yan).
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const segment = decodeURIComponent(new URL(pages[0]?.url ?? "https://x/").pathname.split("/").filter(Boolean).pop() ?? "");
  const slug = letters(segment);
  if (slug.length >= 12) {
    const found = pages[0].lines.slice(0, 120).find((l) => letters(l) === slug && l.length <= 140);
    // The heading instead, when it names a degree and the address adds only a code, year, award or "Honours" to it:
    // the matching line is then a breadcrumb with extras ("Computer Science MSc Honours", "MSc Economics 2025",
    // "Master of Business - 5632") and the heading is the name ("Computer Science MSc", 2026-10-22).
    const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const heading = pages[0].h1[0] ? tidyName(pages[0].h1[0]) : "";
    const inHeading = new Set(words(heading));
    const headingFits =
      inHeading.size >= 2 &&
      heading.length <= 140 &&
      !!degreeOf(heading) &&
      [...inHeading].every((w) => words(segment).includes(w)) &&
      words(segment).every((w) => inHeading.has(w) || /^(\d+|msc|ma|ms|mba|llm|mph|med|mres|pgdip|pgcert|hons|honours)$/.test(w));
    const line = found && headingFits ? heading : found;
    const d = line ? degreeOf(line) : null;
    // A Chinese title before the English one ("市場學…碩士 Master of Science in …"): the English name.
    // Executive and online programmes are left out here too ("Government Administration (Exec), MPA" names it in the heading only).
    const executive = /executive|online/i.test(line ?? "") || /\bexec\b/i.test(pages[0].h1[0] ?? "");
    if (line && d) return { name: tidyName(line.replace(/^[^A-Za-z]*(?=Master|MSc|MA\b|MBA)/, "")), degreeType: degreeType(d), excluded: EXCLUDED_DEGREE.test(d) || executive || DOUBLE_OR_RESEARCH.test(line) || NOT_A_PROGRAMME.test(line) };
  }
  // A section heading about where graduates work ("Industries MIM Graduates Work in", SMU) names no programme.
  const heads = pages.flatMap((p) => [...p.h1, p.ogTitle, p.title]).filter((x): x is string => !!x && !/\bgraduates (work|go)\b/i.test(x));
  for (const raw of heads) {
    let h = tidyName(raw);
    // Titles with taglines ("Master of Business | Flexible Specialisations | Monash"): the part naming the degree.
    if (h.includes(" | ")) {
      const segs = h.split(" | ");
      h = segs.find((s) => degreeOf(s)) ?? segs[0];
    }
    const d = degreeOf(h);
    if (d && h.length <= 140)
      return {
        name: h,
        degreeType: degreeType(d),
        excluded: EXCLUDED_DEGREE.test(d) || /executive|online/i.test(h) || DOUBLE_OR_RESEARCH.test(h) || NOT_A_PROGRAMME.test(h),
      };
  }
  // The heading names the subject only: take the degree from the page's award line, if it has one.
  const h1 = pages[0]?.h1[0]?.replace(SITE_SUFFIX, "").trim();
  if (h1 && h1.length <= 120) {
    // The first award line that names a degree: navigation lines such as "Degree apprenticeships"
    // also start with "Degree". "Finance MSc" (the heading followed by the award) counts too.
    // "Finance MSc" first (the heading followed by its award); then award lines. Navigation links
    // such as "MBA" appear before the programme's own award line, so they come last.
    const top = pages[0].lines.slice(0, 160);
    const award =
      top.find((l) => l.startsWith(h1 + " ") && l.length <= 140 && !!degreeOf(l)) ??
      top.find((l) => /^(award|qualification|degree|award title|qualification awarded)\b/i.test(l) && !!degreeOf(l)) ??
      top.find((l) => /^(MSc|MA|MCom|MFin|MBA|LLM)\b/.test(l) && !!degreeOf(l));
    const d = award ? degreeOf(award) : null;
    if (d)
      return {
        name: award!.startsWith(h1 + " ") && award!.length <= 140 ? award! : h1,
        degreeType: degreeType(d),
        excluded: EXCLUDED_DEGREE.test(d) || /executive|online/i.test(h1) || DOUBLE_OR_RESEARCH.test(h1) || NOT_A_PROGRAMME.test(h1),
      };
  }
  // A catalogue page with a generic title (HKUST: "Program & Course Catalog"): the line under a label
  // such as "Award Title" names the degree.
  const lines = pages[0]?.lines.slice(0, 200) ?? [];
  const at = lines.findIndex((l) => /^(award title|programme title|program title|degree title|title of (the )?(award|programme|program)|name of (the )?(programme|program))$/i.test(l));
  const named = at >= 0 ? tidyName(lines[at + 1] ?? "") : "";
  const d = named.length <= 140 ? degreeOf(named) : null;
  if (d)
    return {
      name: named,
      degreeType: degreeType(d),
      excluded: EXCLUDED_DEGREE.test(d) || /executive|online/i.test(named) || DOUBLE_OR_RESEARCH.test(named) || NOT_A_PROGRAMME.test(named),
    };
  // A heading that gives the subject and course code ("Business Analytics - B6022", Monash) and the degree
  // under a "Qualification" label in the course details, after the site's menus (added 2026-10-22).
  const subject = h1?.replace(/\s+[–—-]\s+[A-Z]\d{4}$/, "").toLowerCase();
  const all = pages[0]?.lines ?? [];
  const q = subject && subject !== h1?.toLowerCase() ? all.findIndex((l, i) => /^(qualification|award)$/i.test(l) && (all[i + 1] ?? "").toLowerCase().includes(subject)) : -1;
  const qualified = q >= 0 ? tidyName(all[q + 1]) : "";
  const dq = qualified.length <= 140 ? degreeOf(qualified) : null;
  if (dq)
    return {
      name: qualified,
      degreeType: degreeType(dq),
      excluded: EXCLUDED_DEGREE.test(dq) || /executive|online/i.test(qualified) || DOUBLE_OR_RESEARCH.test(qualified) || NOT_A_PROGRAMME.test(qualified),
    };
  // A title that gives the subject only ("Public Health | LSHTM") and text that names the degree with it
  // ("When you study MSc Public Health …", "Tuition fees - MSc Public Health"): the degree named with the
  // subject most often, at least twice, and not as the start of a longer name ("MSc Public Health for …").
  const topic = tidyName((pages[0]?.title ?? "").split(/\s+[|–—]\s+/)[0]);
  if (topic.length >= 4 && topic.length <= 80 && !degreeOf(topic)) {
    const subject = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const named = new RegExp(`\\b(MSc|MA|MBA|LLM|MPH|MEd|MRes|MFA|MPA|MPP)\\s+${subject}(?![\\w-]|\\s+(for|and|in|of|with|&)\\b)`, "g");
    const counts = new Map<string, number>();
    for (const l of all) for (const m of l.matchAll(named)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    const [best] = [...counts].sort((a, b) => b[1] - a[1]);
    const dt = best && best[1] >= 2 ? degreeOf(`${best[0]} ${topic}`) : null;
    // (No NOT_A_PROGRAMME check: the name is the page's own title, and "Health Policy, Planning & Financing" is a programme.)
    if (dt) {
      const name = `${best[0]} ${topic}`;
      return { name, degreeType: degreeType(dt), excluded: EXCLUDED_DEGREE.test(dt) || DOUBLE_OR_RESEARCH.test(name) };
    }
  }
  return europeanName(pages[0]) ?? { name: null, degreeType: null, excluded: false };
}

/**
 * European headings that name the award as "Master" without "Master of …" (added 2026-11-01, only for pages
 * the rules above could not name): "Visual Computing (Master)" (TU Wien), "Cyber Security ‒ Master ‐ EPFL",
 * "Game Design & Technology Master's Programme" (Gothenburg), "Global Politics and Communication | Master's
 * programme" (Helsinki), "Master Human-Technology Interaction" (TU/e), "Master's Health Sciences" (VU),
 * "Master [120] in Management" (UCLouvain), "Master parcours Financial economics" (Paris 1). The name is the
 * heading's own words up to the award. A heading with the subject only ("Computing Science") stays unnamed.
 * First-year-only (M1), advanced and work-integrated masters are left out.
 */
function europeanName(p: PageText | undefined): { name: string; degreeType: string; excluded: boolean } | null {
  if (!p) return null;
  const SUBJECT = "[A-Z][\\w&,'’():/ -]{2,100}?";
  const FORMS = [
    new RegExp(`^(${SUBJECT})\\s*\\((?:Master|master)\\)`),
    new RegExp(`^(${SUBJECT}),?\\s+Master['’]s [Pp]rogramme\\b`),
    new RegExp(`^(${SUBJECT})\\s+[|‒–—-]\\s+(?:Master|Master['’]s [Pp]rogramme|master)(?=\\s+[|‒–—‐-]|$)`),
    new RegExp(`^Master \\[\\d+\\] in (${SUBJECT})$`),
    new RegExp(`^Master(?:['’]s)?\\s+(?:parcours\\s+)?(${SUBJECT})$`),
  ];
  for (const raw of [p.h1[0], p.ogTitle, p.title]) {
    if (!raw) continue;
    const h = tidyName(raw.replace(/\s*[‐]\s*[^‐]*$/, (m) => (/master/i.test(m) ? m : ""))).replace(/^Degree program(me)?\s+/i, "");
    for (const form of FORMS) {
      const m = form.exec(h);
      // A list page names no subject: "Master Programme", "Master's Programs", "Master Degree - Department of …".
      if (!m || m[0].length > 140 || /^(degrees?|programs?|programmes?|courses?|studies)\b/i.test(m[1])) continue;
      let name = m[0].trim();
      // A title that adds the site after the heading ("Master's Business Analytics - VU Amsterdam", heading
      // "Business Analytics"): the name ends with the heading.
      const head = p.h1[0]?.trim();
      const at = head && head !== raw ? name.indexOf(head) : -1;
      if (head && at > 0 && /^\s*[|‒–—-]\s/.test(name.slice(at + head.length))) name = name.slice(0, at + head.length);
      // "English Studies | Master's programme" (Helsinki) is the Master's Programme in English Studies; "Cyber Security ‒
      // Master" (EPFL) the Master in Cyber Security: the subject and the award, in the university's own order.
      if (form === FORMS[2]) name = /programme/i.test(name) ? `Master's Programme in ${m[1].trim()}` : `Master in ${m[1].trim()}`;
      return {
        name,
        degreeType: "Master's",
        excluded: /^M1\b|work[- ]integrated|executive|online/i.test(name) || DOUBLE_OR_RESEARCH.test(name) || NOT_A_PROGRAMME.test(name),
      };
    }
  }
  return null;
}

/** Subjects outside Kaplan's 13 disciplines, even when the name also says "management". */
const OUTSIDE =
  /marine|ocean|aquatic|climate|biodiversity|tropical|animal|plant|soil|wildlife|geo(graph|spatial|log)|engineering|medic(ine|al)\b|pharma|environment|water|energy|agri|food|fashion|music|aviation|maritime|shipping|mining|petroleum|forest|urban|planning|architect|heritage|museum|library|archiv|conservation|chemistry|physics|biolog|biomed|biotech|neuroscien|stem cell|mechatron|curat|fine art|(visual|creative|performing|media|liberal) arts?\b|\barts and cultur|design\b/i;
// ("Master of Arts in Translation" is a degree name, not an arts subject: only named art fields are left out.)

/**
 * Kaplan subjects whose usual names carry a word from OUTSIDE ("software engineering", "data mining",
 * "games design"): taken out before that check (added 2026-10-22).
 */
const KAPLAN_PHRASES =
  /\b(software|data|financial|security|cloud|network|knowledge|requirements|(computer|information|software) systems) engineering\b|\bdata mining\b|\b(games?|interaction|user experience|ux|web|instructional|learning) design\b|\btechnology and design\b/g;
// ("Technology and Design" is SUTD's degree title: "Master of Science in Technology and Design (Data Science)".)

/**
 * For a name with a word from OUTSIDE: a Kaplan subject it is still about (added 2026-10-22). Finance
 * named last ("Aviation Finance", but not "Engineering with Finance"); AI or data science applied to a
 * field ("Artificial Intelligence for Weather and Climate", "Medical Statistics and Data Science", but
 * not "Environmental Engineering with Data Science"); education or real estate named first
 * ("Education (Geography)", "International Real Estate and Planning"); and the business side of a
 * sector ("Fashion Marketing", "Maritime Business and Logistics").
 */
function despiteOutside(n: string): Discipline | null {
  // The part before a colon governs ("Digital Chemistry: AI, Automation and Data Science" is chemistry).
  const bare = n.split(/:\s/)[0].replace(/\s+(msc|ma|ms|mba|mres|mfin|mcom|master'?s|pgdip|pgcert|ft|full-time|20\d\d)\b.*$/, "").trim();
  if (/(?<!with )\bfinance$/.test(bare)) return "accounting-finance";
  if (!/\swith\s/.test(bare) && (/^(artificial intelligence|ai|machine learning|data science|data analytics)\s+(for|in)\s/.test(bare) || /\b(data science|data analytics|big data|machine learning)$/.test(bare))) return "ai-data";
  const lead = bare.replace(/^((msc|ma|ms|master of|masters in|master's in|science|arts|in|advanced|applied|international|global)\s+)+/, "");
  if (/^educat/.test(lead)) return "education";
  if (/^(real estate|quantity surveying|construction)\b/.test(lead)) return "construction";
  // Management for engineers, as in Kaplan's own "MSc Engineering Business Management" (added 2026-10-22).
  if (/^engineering (business |enterprise )?management\b/.test(lead)) return "business";
  if (/\bfor learning\b/.test(bare)) return "education";
  if (/\bfashion (marketing|branding|promotion)|\bluxury (brand|marketing)/.test(n)) return "marketing";
  if (/\b(fashion|music|aviation|maritime|shipping|food) (business|management|industry|enterprise|retail|logistics)|\bmaritime (business|economics and logistics)|\bshipping and logistics/.test(n)) return "business";
  // Arts management is business, media arts and filmmaking are communication (the user's call, 2026-10-22).
  if (/\b(arts?|cultural) (administration|management|leadership|entrepreneurship)\b|\bcreative arts entrepreneurship\b/.test(n)) return "business";
  if (/\b(interactive )?media arts?\b|\bfilmmaking\b/.test(n)) return "communication";
  return null;
}

/** One of Kaplan's 13 disciplines, from the programme name only. Null when it doesn't clearly belong to one. */
export function classifyDiscipline(name: string): Discipline | null {
  const n = name.toLowerCase();
  // Counselling and psychotherapy before health: "Counselling and Psychotherapy specialising in Clinical Practice".
  if (/counsel|psychotherap/.test(n)) return "psychology-counselling";
  // Health and law first: "health psychology", "medical law" belong there before the generic checks.
  if (/nurs|midwif|public health|community health|\bmph\b|health(care)? (management|leadership|administration|services|informatics|policy)|global health|clinical (practice|leadership)/.test(n)) return "healthcare-nursing";
  // Not engineering ("Medical Electronics and Digital Health").
  if (/health ?care (leadership|management|improvement|quality)|health service|digital health|population health|evidence-based health ?care/.test(n) && !/engineer|electronic/.test(n)) return "healthcare-nursing";
  // Talking therapies only: physiotherapy, occupational, radiation, sports and arts therapies are other subjects.
  // ("\bmental health": not "Environmental Health and Safety".)
  if (/psycholog|psychoanaly|counsel|psychotherap|(cognitive|behaviou?ral|family|couples?|marriage|narrative|psychological|talking|schema|play|systemic|integrative|humanistic|gestalt|child|existential) therap(y|ies)|psychological therapies|\bmental health|wellbeing|behaviou?ral science/.test(n)) return "psychology-counselling";
  if (/\blaws?\b|\bllm\b|legal|criminolog|criminal justice|policing|crime/.test(n)) return "law-criminology";
  // Tourism and hotels even with a word from OUTSIDE ("Heritage Tourism", "Food and Hotel Management").
  if (/hospitality|tourism|hotel/.test(n)) return "hospitality-tourism";
  if (OUTSIDE.test(n.replace(KAPLAN_PHRASES, (m) => m.replace(/ (engineering|mining|design)$/, "")))) return despiteOutside(n);
  if (/hospitality|tourism|\bevents?\b|hotel/.test(n)) return "hospitality-tourism";
  if (/education|teaching|\btesol\b|early (years|childhood)|\bmed\b|pedagog/.test(n)) return "education";
  if (/construction|quantity surveying|built environment|real estate|property|building information/.test(n)) return "construction";
  if (/\bsports?\b|exercise|coaching|physical activity|strength and conditioning/.test(n)) return "sports-science";
  if (/marketing|\bbrand|advertising|consumer (analytics|behaviou?r|insights?)/.test(n)) return "marketing";
  if (/public relations|(?<!tele)communication|\bmedia\b|journalism|broadcast|\bfilm\b|digital content/.test(n)) return "communication";
  if (/artificial intelligence|\bai\b|machine learning|data science|\bdata\b|analytics|business intelligence/.test(n)) return "ai-data";
  // Before finance: "Computer Science (General, Cyber Security, Financial Computing … Streams)".
  if (/\bcomputer science\b/.test(n)) return "it";
  if (/financ|banking|accounting|accountancy|investment|fintech|actuarial|economics|\bmsf\b|\bmfin\b|audit|\btax/.test(n)) return "accounting-finance";
  if (/comput|software|cyber|information (technology|systems|security)|\bit\b|network|\bgames?\b|cloud|robotic|digital forensic|internet of things|\biot\b|user experience|interaction design|human[- ]computer interaction|\bhci\b|\bux\b/.test(n)) return "it";
  // ("Commerce" but not "e-commerce", which is marketing below.)
  if (/business|management|\bmba\b|administration|entrepreneur|innovation|strategy|leadership|human resource|\bhrm\b|supply chain|logistics|international (business|trade|relations)|operations|consult|(?<!e-)\bcommerce\b/.test(n)) return "business";
  // Neighbouring subjects Kaplan graduates go on to (added 2026-10-20 for Hong Kong, Macau and Singapore,
  // whose catalogues name them this way): statistics, language and translation, social work, public policy.
  if (/statistic|quantitative/.test(n)) return "ai-data";
  // Not "translational" research; clinical linguistics is speech and language therapy.
  if (/translat(ion|ing)|interpreting|linguistic|language studies|english studies|applied language/.test(n) && !/clinical|speech/.test(n)) return "communication";
  if (/social work|social service|social welfare/.test(n)) return "psychology-counselling";
  if (/public (policy|administration|affairs)|governance|policy studies|social policy/.test(n)) return "business";
  // Names the checks above miss (added 2026-10-22).
  if (/insurance|wealth management|econometric/.test(n)) return "accounting-finance";
  if (/procurement|purchasing|retail|luxury|non-?profit|organi[sz]ational (behaviou?r|change|development)|\bmpa\b/.test(n)) return "business";
  if (/e-?commerce/.test(n)) return "marketing";
  if (/publishing/.test(n)) return "communication";
  if (/human[- ]computer interaction|\bhci\b|interaction design|user experience|\bux\b|blockchain|information management|games? design/.test(n)) return "it";
  if (/learning (design|sciences?|technolog)|instructional design|educational technology/.test(n)) return "education";
  if (/\bbim\b/.test(n)) return "construction";
  return null;
}

/** Conversion programmes: the entry requirement accepts a degree in any subject. */
export const ANY_BACKGROUND =
  /\b(in )?any (discipline|subject|field)\b|any (undergraduate|bachelor'?s) (degree|discipline)|from any (academic )?(discipline|background|subject)|non-(cognate|related|specialist)|conversion (course|programme|master)|regardless of (your )?(previous |prior |academic )?(subject|discipline|background)/i;

/** Online-only programmes are left out. Part-time-only ones are kept and tagged (2026-10-20): many Hong Kong
 * programmes are part-time only, and students should see them, marked as not usually open to student-visa holders. */
export function studyMode(p: PageText): "online" | "part-time" | null {
  const top = p.lines.slice(0, 70);
  // The programme's heading only: later h1s can be site furniture ("Online services" on Strathclyde).
  const heads = [p.h1[0] ?? "", p.title ?? ""].join(" ");
  // The programme's own delivery line, not a mention of another (online) course on the page.
  const delivery = top.flatMap((l, i) => (/^(delivery( type| mode)?|study mode|mode of study|attendance( mode)?|study options?|location):?$/i.test(l) ? top.slice(i + 1, i + 4) : []));
  // "Delivery mode: In person / Online" (Flinders) offers both: online only when no in-person option is listed.
  const inPerson = delivery.some((l) => /in[- ]person|on[- ]campus|face[- ]to[- ]face|blended|^campus\b/i.test(l));
  if (
    /\bonline\b|distance learning/i.test(heads) ||
    (!inPerson && delivery.some((l) => /online exclusive|^(fully )?online\b|^distance/i.test(l))) ||
    // ("This is a full online program", Mahidol, 2026-11-01.)
    top.slice(0, 25).some((l) => /fully[- ]online|100% online|delivered (entirely |fully )?online/i.test(l) && !/also offer|also available/i.test(l)) ||
    top.some((l) => /^this is a full(y)? online program/i.test(l)) ||
    // Virginia Tech's catalogue: "Campus(es) where program is offered: Virtual".
    p.lines.some((l, i) => /^campus(\(es\)|es)? where (the )?program is offered:?\s*(virtual|online)?$/i.test(l) && /^(virtual|online)\.?$/i.test(/virtual|online/i.test(l) ? "virtual" : (p.lines[i + 1] ?? "")))
  )
    return "online";
  const lengths = top.filter((l) => /\b\d{1,2}\s*(months?|years?)\b/i.test(l) && l.length < 120);
  if (lengths.some((l) => /part[- ]time/i.test(l)) && !lengths.some((l) => /full[- ]time/i.test(l)) && !top.some((l) => /^full[- ]time/i.test(l)))
    return "part-time";
  return null;
}

/**
 * A page that says the programme is a thesis-only degree or is not offered (added 2026-11-01 after the sample
 * check: Otago's LLM "involves the completion of a thesis; there is no coursework requirement", McGill's
 * "This program is currently not offered"). Its first 150 lines only, where the programme describes itself.
 */
export function notTaught(p: PageText): "thesis only" | "not offered" | null {
  const top = p.lines.slice(0, 150);
  // The whole degree, not one option of it ("Thesis only: 60 credits" is a track in Maryland's catalogue).
  if (top.some((l) => /there is no coursework requirement|\bno coursework requirement\b|\b(degree|programme|program) is by thesis only\b/i.test(l))) return "thesis only";
  // Said of this programme, not of a module ("Terms offered: this course is not currently offered", "Where a module is no
  // longer available …"): "This program has been discontinued", "The degree program has been discontinued", "The Master of
  // … programme is no longer accepting new students", "This course is no longer accepting applications" (UK: course = programme),
  // "This course is not currently offered … to international students with a student visa" (ECU).
  const NOT_OFFERED = [
    /^(this|the)( degree| master['’]?s?)? (program|programme)( of study)? (is|has been) (currently )?(no longer (accepting|available|offered)|not currently offered|not offered|discontinued|suspended)/i,
    /^(the|this) .{3,90} (program|programme) is no longer accepting/i,
    /\bthis (program|programme) is no longer (available|accepting|offered)\b/i,
    /^this course is no longer (accepting applications|available)\b/i,
    /^this course is not currently offered\b.*\binternational students\b/i,
    /\binterest in this course\. Unfortunately,? it['’]?s no longer available/i,
    /\bno longer accepting new students into this (program|programme)\b/i,
    // "There will be no admission to this programme in 2027." (Oslo); "There will be no intake to the Master's Programme in
    // Finance for studies starting in autumn 2027" (Aalto); "This programme is being phased out: you can no longer choose it" (Ghent).
    /^(please note!?\s*)?there will be no (admission|intake) to (this|the) .{0,80}(program|programme)\b/i,
    /\b(program|programme) is being phased out\b|\byou can no longer choose it\b/i,
    // "… this programme is not open to non-EU students due to Visa/Immigration requirements" (Limerick): closed to our students.
    /\b(program|programme|course) is not open to (non-EU|non-EEA|international) (students|applicants)\b/i,
  ];
  if (top.some((l) => NOT_OFFERED.some((re) => re.test(l)))) return "not offered";
  return null;
}

/** One entry naming two degrees ("MBA and MSFin", University of the Philippines): two programmes, left out. */
const TWO_DEGREES = /\b(MBA|MSc|MS|MA|MSFin|MFin|LLM|MPH|MPA|MEd|MIM)\s+(and|&)\s+(MBA|MSc|MS|MA|MSFin|MFin|LLM|MPH|MPA|MEd|MIM)\b/;

// ---------- Sections and lines ----------

const ENTRY_HEADING = /^(entry requirements?|admission requirements?|academic requirements?|requirements|eligibility|entry criteria|who can apply|minimum requirements?)\b/i;

/** Lines of the entry-requirements section when the page has one, otherwise all lines. */
function focus(p: PageText): string[] {
  const i = p.lines.findIndex((l) => ENTRY_HEADING.test(l) && l.length < 60);
  return i >= 0 ? p.lines.slice(i, i + 250) : p.lines;
}

function capSentence(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

// ---------- Academic requirement ----------

const ACADEMIC =
  /(upper second|lower second|\b2[:.]1\b|\b2[:.]2\b|first[- ]class|second[- ]class|honours degree|bachelor['’]?s? degree|undergraduate degree|good degree|\bGPA\b|grade point|weighted average|\bWAM\b|credit average|minimum average)/i;

// Sentences about the course itself, not what it asks of applicants ("prior study of modules in…" is a requirement).
const ABOUT_COURSE = /(project units?|capstone|internship|placement|careers?\b|you will (learn|study|develop)|graduates (go|have)|scholarship)/i;

function academicAt(lines: string[]): number {
  return lines.findIndex(
    (l, i) =>
      l.length >= 20 &&
      l.length <= 900 &&
      !ABOUT_COURSE.test(l) &&
      ((ACADEMIC.test(l) && /degree|GPA|average|WAM|classification|honours|\b2[:.][12]\b/i.test(l) && l.length >= 40) ||
        // "Minimum academic requirement" / "Minimum entry standard" followed by "2:1 in a quantitative subject…"
        (/(academic|entry) (requirement|standard)s?:?$/i.test(lines[i - 1] ?? "") && /^(a |an )?(2[:.][12]|first|upper|lower|good|bachelor|minimum|an? (honours|undergraduate|bachelor))/i.test(l))),
  );
}

function findAcademic(pages: PageText[]): Evidence | null {
  for (const p of pages) {
    for (const lines of [focus(p), p.lines]) {
      const i = academicAt(lines);
      if (i < 0) continue;
      let text = lines[i];
      // A requirement often continues on the next line ("…or an equivalent overseas qualification").
      const next = lines[i + 1];
      if (next && text.length < 220 && /^(or|and|in|with|from|including|normally|typically|we|you|applicants?|equivalent|\(|a )/i.test(next) && next.length < 300)
        text += " " + next;
      return { text: capSentence(text, 500), url: p.url };
    }
  }
  return null;
}

// ---------- Background / prerequisites ----------

const BACKGROUND = /(background in|prior (study|knowledge)|prerequisite|quantitative|mathemat|statistic|calculus|programming|relevant (subject|discipline|field)|in a related (subject|discipline|field)|in any (discipline|subject))/i;

function findBackground(pages: PageText[], academic: string | null): Evidence | null {
  for (const p of pages) {
    const l = focus(p).find((x) => BACKGROUND.test(x) && x.length >= 40 && x.length <= 600 && (!academic || !academic.includes(x)) && !/module|you will (learn|study)|career|loan|funding|scholarship|bursar/i.test(x));
    if (l) return { text: capSentence(l, 400), url: p.url };
  }
  return null;
}

// ---------- English language ----------

const ENGLISH_HEADING = /^(english( language)?( requirements?| proficiency| test)?s?|language requirements?|english language entry requirements?)\s*:?$/i;
// Level names are matched in any case; the level letter only in capitals ("Band D", "band: B", not "band a …").
const LEVEL_WORDS =
  /\b([Bb]and|[Pp]rofile|[Ll]evel|[Cc]ategory|[Gg]roup|[Tt]ier)\s*:?\s+[A-E1-9]\b|\b([Ss]tandard|[Hh]igher)\s+(level|requirement|university requirement|English)\b|\b(requirement|level)\s+(is|:)\s+([Ss]tandard|[Hh]igher)\b/;
const SEE_ELSEWHERE = /please see|find out more|visit our|for (more|further) information|further details|check our|view our|is not your first language, you/i;
const SCORE = /^[4-9](\.[05])?$/;
const SCORE_LABEL = /^(overall( score| band)?|reading|writing|speaking|listening)$/i;

/**
 * The scores that follow an IELTS line which doesn't give them itself: a sentence on the next line
 * ("6.5 overall with no subtest less than 6.0"), label/value pairs ("overall score" / "6.5" /
 * "reading" / "6.0" …), or a table row (labels above the IELTS line, bare scores below it).
 */
function scoresAfter(lines: string[], i: number): string | null {
  const next = lines.slice(i + 1, i + 14);
  if (next[0] && /\b[4-9](\.[05])?\b/.test(next[0]) && !SCORE.test(next[0]) && next[0].length < 200) return next[0];
  const pairs: string[] = [];
  for (let k = 0; k + 1 < next.length; k++) {
    if (SCORE_LABEL.test(next[k]) && SCORE.test(next[k + 1])) {
      pairs.push(`${next[k]} ${next[k + 1]}`);
      k++;
    }
  }
  if (pairs.length) return pairs.join(", ");
  const header: string[] = [];
  for (let k = i - 1; k >= Math.max(0, i - 8) && SCORE_LABEL.test(lines[k]); k--) header.unshift(lines[k]);
  const values: string[] = [];
  for (const l of next) {
    if (!SCORE.test(l)) break;
    values.push(l);
  }
  if (header.length >= 2 && values.length === header.length) return header.map((h, k) => `${h} ${values[k]}`).join(", ");
  return null;
}

function findEnglish(pages: PageText[]): { ev: Evidence | null; distinct: number } {
  for (const p of pages) {
    const lines = p.lines;
    const all = new Set(Array.from(lines.join("\n").matchAll(/IELTS[^.\n]{0,40}?\b([4-9]\.[05])\b/gi), (m) => m[1]));
    // 1. A line naming IELTS with its score.
    const idx = lines.findIndex((l) => /IELTS/i.test(l) && /\b[4-9](\.[05])?\b/.test(l) && l.length >= 12);
    if (idx >= 0) {
      let text = lines[idx];
      const next = lines[idx + 1];
      // Component minimums are often on the following line.
      if (next && text.length < 220 && /(each|all|every|component|band|element|minimum|no less|subscore|sub-score|subtest|section|reading|writing|listening|speaking)/i.test(next) && next.length < 250)
        text += " " + next;
      return { ev: { text: capSentence(text, 400), url: p.url }, distinct: all.size };
    }
    // 2. A line naming IELTS whose scores follow it.
    for (let i = 0; i < lines.length; i++) {
      if (!/IELTS/i.test(lines[i]) || lines[i].length > 200) continue;
      const scores = scoresAfter(lines, i);
      if (scores) return { ev: { text: capSentence(`${lines[i]} ${scores}`, 400), url: p.url }, distinct: all.size };
    }
    // 3. The lines under an "English language requirements" heading (a named band or level).
    for (let h = 0; h < lines.length; h++) {
      if (!ENGLISH_HEADING.test(lines[h])) continue;
      const body = lines.slice(h + 1, h + 5).find((l) => l.length >= 4 && (LEVEL_WORDS.test(l) || /TOEFL|PTE|IELTS/.test(l)) && !ENGLISH_HEADING.test(l));
      if (body) {
        const text = body.length < 40 && !/english/i.test(body) ? `${lines[h].replace(/:$/, "")}: ${body}` : body;
        return { ev: { text: capSentence(text, 400), url: p.url }, distinct: all.size };
      }
    }
    // 4. A sentence naming the English level.
    const l = lines.find((x) => /english language/i.test(x) && LEVEL_WORDS.test(x) && x.length >= 25 && !SEE_ELSEWHERE.test(x));
    if (l) return { ev: { text: capSentence(l, 400), url: p.url }, distinct: all.size };
  }
  return { ev: null, distinct: 0 };
}

// ---------- Other tests ----------

export type Tests = { toefl: number | null; pte: number | null; duolingo: number | null; gre: AdmissionTest | null; gmat: AdmissionTest | null };

/**
 * The first line (or the line and the next, when the score sits under the test name) that names
 * each test with a value: a score in the test's range, or for GRE / GMAT a stated status. A bare
 * mention of GRE / GMAT counts only when no line says more.
 */
function findTests(pages: PageText[]): { tests: Tests; evidence: Record<string, Evidence> } {
  const tests: Tests = { toefl: null, pte: null, duolingo: null, gre: null, gmat: null };
  const evidence: Record<string, Evidence> = {};
  for (const test of ["toefl", "pte", "duolingo"] as const) {
    outer: for (const p of pages) {
      for (let i = 0; i < p.lines.length; i++) {
        if (!TEST_NAMES[test].test(p.lines[i]) || p.lines[i].length > 400) continue;
        for (const text of [p.lines[i], `${p.lines[i]} ${p.lines[i + 1] ?? ""}`]) {
          const v = englishTestScore(test, text);
          if (v !== null) {
            tests[test] = v;
            evidence[test] = { text: capSentence(text, 400), url: p.url };
            break outer;
          }
        }
      }
    }
  }
  for (const test of ["gre", "gmat"] as const) {
    let mention: { t: AdmissionTest; ev: Evidence } | null = null;
    let found = false;
    for (const p of pages) {
      for (const line of p.lines) {
        if (found || !TEST_NAMES[test].test(line) || line.length > 500) continue;
        const t = admissionTest(test, line);
        if (!t) continue;
        const ev = { text: capSentence(line, 400), url: p.url };
        if (t.status !== "mentioned") {
          tests[test] = t;
          evidence[test] = ev;
          found = true;
        } else mention ??= { t, ev };
      }
    }
    if (!found && mention) {
      tests[test] = mention.t;
      evidence[test] = mention.ev;
    }
  }
  return { tests, evidence };
}

// ---------- Duration, intake, deadline ----------

const DURATION = /\b(\d{1,2}(?:\.\d)?|one|two|three|nine|ten|eleven|twelve|fifteen|sixteen|eighteen|twenty[- ]four)[\s-]*(months?|years?|yrs?)\b/i;

/** Sentences that mention a length of time without being the programme's length. */
// ("bachelor's degree of not less than three years", CEU; "requiring at least three years' full-time tertiary study",
// Otago; "Full-time program fee duration 12 months", Dalhousie: the entry degree's or the fee's length, 2026-11-01.)
const NOT_LENGTH = /ago|old\b|experience|within|after|valid|deferr|internship|placement|work|project|research|dissertation|for more than|graduation|semester abroad|exchange|bachelor|undergraduate|tertiary|\bfees?\b/i;

/** A programme length is between 6 months and 3 years; anything else is a misread. */
const plausible = (text: string) => {
  const m = parseDurationMonths(text);
  return m !== null && m >= 6 && m <= 36;
};

function findDuration(pages: PageText[]): Evidence | null {
  for (const p of pages) {
    const lines = p.lines.slice(0, 400);
    const ok = (x: string) => DURATION.test(x) && !NOT_LENGTH.test(x) && plausible(x);
    const l =
      lines.find((x) => ok(x) && /full[- ]time|duration|length|course length|study mode/i.test(x) && x.length <= 160) ??
      lines.find((x, i) => /^(duration|length|course length|program(me)? length|full[- ]time)\b/i.test(x) && x.length < 40 && ok(lines[i + 1] ?? "")) ??
      lines.slice(0, 45).find((x) => ok(x) && x.length <= 80);
    if (l) {
      const i = lines.indexOf(l);
      const text = DURATION.test(l) ? l : `${l} ${lines[i + 1]}`;
      return { text: capSentence(text, 160), url: p.url };
    }
  }
  return null;
}

const MONTH = "(January|February|March|April|May|June|July|August|September|October|November|December)";
const DATE = new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH},?\\s+20\\d{2}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+20\\d{2})\\b`, "i");

function findIntake(pages: PageText[]): Evidence | null {
  const re = new RegExp(`(start date|starts?|intake|entry|commenc\\w*)\\W{0,25}(${MONTH}(?:\\s+20\\d{2})?)`, "i");
  for (const p of pages) {
    const l = p.lines.slice(0, 400).find((x) => re.test(x) && x.length <= 160);
    if (l) return { text: capSentence(l, 160), url: p.url };
    const i = p.lines.slice(0, 400).findIndex((x) => /^(start date|start dates|intake|entry dates?)$/i.test(x));
    if (i >= 0 && new RegExp(`^${MONTH}`, "i").test(p.lines[i + 1] ?? "")) return { text: `${p.lines[i]}: ${p.lines[i + 1]}`.slice(0, 160), url: p.url };
  }
  return null;
}

function findDeadline(pages: PageText[]): Evidence | null {
  for (const p of pages) {
    const l = p.lines.find((x) => /(deadline|closing date|apply by|applications close)/i.test(x) && DATE.test(x) && x.length <= 300);
    if (l) return { text: capSentence(l, 240), url: p.url };
  }
  return null;
}

// ---------- Tuition ----------

const MONEY = /(£|€|A\$|AU\$|AUD\s?|S\$|SGD\s?|HK\$|HKD\s?|NZ\$|NZD\s?|C\$|CAD\s?|US\$|USD\s?|\$)\s?(\d{1,3}(?:,\d{3})+|\d{4,6})(?:\.\d{2})?/;
const RANGE: Partial<Record<Currency, [number, number]>> = {
  GBP: [8000, 80000], EUR: [5000, 80000], AUD: [15000, 150000], SGD: [15000, 150000], HKD: [60000, 700000],
  NZD: [15000, 150000], CAD: [10000, 150000], USD: [10000, 150000],
};
const DOLLAR_BY_COUNTRY: Record<string, Currency> = {
  Australia: "AUD", Singapore: "SGD", "Hong Kong SAR": "HKD", "New Zealand": "NZD", Canada: "CAD", "United States": "USD",
};

function currencyOf(sym: string, country: string | null): Currency | null {
  const s = sym.trim().toUpperCase();
  if (s === "£") return "GBP";
  if (s === "€") return "EUR";
  if (s === "A$" || s === "AU$" || s === "AUD") return "AUD";
  if (s === "S$" || s === "SGD") return "SGD";
  if (s === "HK$" || s === "HKD") return "HKD";
  if (s === "NZ$" || s === "NZD") return "NZD";
  if (s === "C$" || s === "CAD") return "CAD";
  if (s === "US$" || s === "USD") return "USD";
  if (s === "$") return country ? (DOLLAR_BY_COUNTRY[country] ?? null) : null;
  return null;
}

function findTuition(pages: PageText[], country: string | null): { value: Extracted["tuition"]; ev: Evidence | null } {
  for (const p of pages) {
    const L = p.lines;
    for (let i = 0; i < L.length; i++) {
      const line = L[i];
      const intl = /international|overseas|non[- ]?eu\b|non[- ]?eea|non-uk|non-local|full[- ]fee/i.test(line);
      if (!intl) continue;
      // The amount is on this line, or on the next line of a fees table.
      const candidates = [line, `${line} ${L[i + 1] ?? ""}`];
      for (const text of candidates) {
        const m = MONEY.exec(text);
        if (!m) continue;
        const currency = currencyOf(m[1], country);
        const amount = Number(m[2].replace(/,/g, ""));
        const range = currency ? RANGE[currency] : null;
        if (!currency || !range || amount < range[0] || amount > range[1]) continue;
        if (/scholarship|deposit|application fee|living|accommodation|bursary|discount/i.test(text)) continue;
        const context = [L[i - 1] ?? "", text].join(" ");
        if (!/tuition|fee|cost|price|per (year|annum)|total/i.test(context) && !/fee/i.test(p.url)) continue;
        const basis = capSentence(text, 200);
        return { value: { amount, currency, basis }, ev: { text: basis, url: p.url } };
      }
    }
  }
  return { value: null, ev: null };
}

// ---------- Whole programme ----------

export function extractProgramme(pagesIn: Page[], country: string | null): Extracted {
  const pages = pagesIn.map(pageText);
  const notes: string[] = [];
  const evidence: Record<string, Evidence> = {};
  const nd = nameAndDegree(pages);
  const mode = studyMode(pages[0]);
  if (mode === "online") nd.excluded = true;
  if (mode === "part-time") notes.push("part-time only");
  const untaught = notTaught(pages[0]);
  // One year of a two-year French master's ("M1 Sport Sciences …", "Master year 2 in Consulting …"), 2026-11-01: as two degrees.
  // (Also a page titled "Financial Markets - 203 - Master's Year 1", PSL.)
  const twoDegrees =
    !!nd.name &&
    (TWO_DEGREES.test(nd.name) ||
      /^(M[12]\b|Master year [12]\b)/i.test(nd.name) ||
      /\bMaster['’]?s? Year [12]\b/i.test(`${pages[0].title ?? ""} ${pages[0].h1[0] ?? ""}`) ||
      // (Dauphine: ".../masters-year-1-financial-markets-203".)
      /\/masters?-year-[12]\b/i.test(pages[0].url));
  if (nd.excluded) notes.push(mode ? `excluded: ${mode} only` : "excluded degree type (research, executive, professional or online)");
  else if (untaught || twoDegrees) {
    nd.excluded = true;
    notes.push(`excluded: ${untaught ?? (TWO_DEGREES.test(nd.name ?? "") ? "two degrees in one entry" : "one year of a two-year master's")}`);
  }
  const discipline = nd.name ? classifyDiscipline(nd.name) : null;
  if (nd.name && !discipline && !nd.excluded) notes.push("outside Kaplan's 13 disciplines");
  if (nd.name) evidence.name = { text: nd.name, url: pages[0].url };

  const textLength = pages.reduce((n, p) => n + p.lines.join(" ").length, 0);
  if (textLength < 800) notes.push("little text in the HTML (the page may be rendered by JavaScript)");

  const acad = findAcademic(pages);
  if (acad) evidence.academic = acad;
  else notes.push("academic requirement not found");
  const bg = findBackground(pages, acad?.text ?? null);
  if (bg) evidence.background = bg;
  const eng = findEnglish(pages);
  if (eng.ev) evidence.english = eng.ev;
  else notes.push("English language requirement not found");
  if (eng.distinct > 1) notes.push(`${eng.distinct} different IELTS overall scores on the page; the first requirement line is used`);
  const t = findTests(pages);
  Object.assign(evidence, t.evidence);
  const dur = findDuration(pages);
  if (dur) evidence.duration = dur;
  const intake = findIntake(pages);
  if (intake) evidence.intake = intake;
  const deadline = findDeadline(pages);
  if (deadline) evidence.deadline = deadline;
  const tu = findTuition(pages, country);
  if (tu.ev) evidence.tuition = tu.ev;

  return {
    name: nd.name,
    degreeType: nd.excluded ? null : nd.degreeType,
    discipline: nd.excluded ? null : discipline,
    // From the entry requirement only: funding text ("Master's loans … in any subject area") is not a requirement.
    acceptsAnyBackground:
      [acad?.text, bg?.text].some((t) => !!t && ANY_BACKGROUND.test(t) && !/loan|funding|scholarship|bursar/i.test(t)) ||
      /conversion/i.test(nd.name ?? ""),
    academic: acad?.text ?? null,
    academicStructured: acad ? academicStructured(acad.text) : null,
    background: bg?.text ?? null,
    english: eng.ev?.text ?? null,
    englishScores: eng.ev ? englishScores(eng.ev.text) : null,
    tests: t.tests,
    duration: dur?.text ?? null,
    intake: intake?.text ?? null,
    deadline: deadline?.text ?? null,
    tuition: tu.value,
    evidence,
    notes,
  };
}

/**
 * A programme name read by Claude for a page the rules could not name (scripts/pipeline/name-ai.ts,
 * quote-checked against the page), applied to the rules' result: degree type and field follow from it.
 */
export function applyName(x: Extracted, name: string): Extracted {
  const clean = tidyName(name);
  const d = degreeOf(clean);
  if (!d) return x;
  const excluded = EXCLUDED_DEGREE.test(d) || /executive|online/i.test(clean) || DOUBLE_OR_RESEARCH.test(clean) || NOT_A_PROGRAMME.test(clean);
  const discipline = excluded ? null : classifyDiscipline(clean);
  return {
    ...x,
    name: clean,
    degreeType: excluded ? null : degreeType(d),
    discipline,
    notes: [...x.notes, "name read by Claude from the page (quote checked)", ...(discipline || excluded ? [] : ["outside Kaplan's 13 disciplines"])],
  };
}
