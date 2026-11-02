// Shared by /pathway (server) and its view (browser): top-up and partner bachelor's degrees taught in
// Singapore (data/raw/topups.json), and how a diploma student's background compares with each one's
// published entry requirements. The comparison only reads the programme's own words; it never
// estimates a chance of admission.

export type Route = "top-up" | "advanced-standing" | "direct-honours" | "full-degree";

export type TopupCard = {
  id: string;
  provider: string;
  providerName: string;
  kaplanId: string | null;
  name: string;
  university: string | null;
  discipline: string;
  route: Route | null;
  routeText: string | null;
  months: [number, number] | null;
  /** Bit i = month i+1. */
  intake: number;
  coreModules: string[];
  qualifications: string[];
  fieldRequirement: string | null;
  gradeRequirement: string | null;
  english: string[];
  ieltsMin: number | null;
  workExperience: string | null;
  international: boolean | null;
  /** Why a Student's Pass holder can't take it as listed, read from the page's study modes
   * (data/raw/topup-international.json): no full-time mode now, or full-time for local applicants only. */
  access: "part-time-only" | "local-only" | null;
  accessQuote: string | null;
  /** Murdoch single majors that are local only: the double majors with this major that Kaplan opens to international applicants. */
  doubleMajors: { name: string; url: string; fee: number | null; feeText: string | null }[];
  /** Lowest stated programme fee for the student's status, in S$ (approximate when converted). */
  feeLocal: number | null;
  feeInternational: number | null;
  feeText: string | null;
  grants: string[];
  /** CSCSE: the month certification starts from ("2011-07"); null if the school or this pair isn't listed. */
  cscse: { from: string; pair: boolean } | null;
  url: string;
  retrievedAt: string;
};

export type Background = {
  /** "kaplan" or another school's id. */
  school: string;
  discipline: string | null;
  level: "diploma" | "advanced-diploma" | "higher-diploma";
  studentPass: boolean;
  ielts: number | null;
};

export type CheckState = "met" | "check" | "not";
export type Check = { key: "entry" | "field" | "english" | "pass"; state: CheckState; label: string; quote: string | null };

/** Field names a programme can belong to: Kaplan's 13 disciplines, read from the degree's own name. */
const FIELD_RULES: [string, RegExp][] = [
  ["ai-data", /data science|artificial intelligence|machine learning|big data|data analytics/i],
  ["it", /comput|cyber|software|information technology|information systems|digital forensics|games?\b|internet of things|network|digital systems/i],
  ["accounting-finance", /accounting|accountancy|finance|banking|fintech/i],
  ["marketing", /marketing|advertising/i],
  ["communication", /communication|media|journalism|public relations/i],
  ["psychology-counselling", /psycholog|counselling|social work|sociology/i],
  ["law-criminology", /\blaws?\b|legal|criminolog/i],
  ["hospitality-tourism", /hospitality|tourism|events/i],
  ["education", /education|early childhood/i],
  ["healthcare-nursing", /nursing|health|paramedic|biomedical/i],
  ["construction", /construction|quantity surveying|built environment/i],
  ["sports-science", /sport/i],
  ["business", /business|management|commerce|human resource|logistics|supply chain|trade|entrepreneur|economics/i],
];

export function fieldOf(name: string): string {
  return FIELD_RULES.find(([, re]) => re.test(name))?.[0] ?? "other";
}

const has = (lines: string[], re: RegExp) => lines.find((l) => re.test(l)) ?? null;

/** How the student's background lines up with one programme's published requirements. */
export function compare(t: TopupCard, b: Background): Check[] {
  const q = t.qualifications;
  const checks: Check[] = [];

  // Entry: is the student's kind of diploma among the accepted qualifications?
  const kaplanLine = has(q, /kaplan\b.*diploma/i);
  const peiLine = has(q, /private education institution|private diploma|singapore-registered|\bPEI/i);
  const caseLine = has(q, /case-by-case|equivalent/i);
  const advancedOnly = q.length > 0 && q.every((l) => /advanced diploma|higher national diploma|\bHND\b|foundation degree|degree/i.test(l));
  const ownSchool = b.school === t.provider;
  const accepted = ownSchool ? has(q, /diploma/i) ?? caseLine : b.school === "kaplan" ? kaplanLine ?? peiLine : peiLine;
  if (!q.length) checks.push({ key: "entry", state: "check", label: "Entry: not stated", quote: null });
  else if (advancedOnly && b.level === "diploma") checks.push({ key: "entry", state: "not", label: "Needs an advanced diploma", quote: q[0] });
  else if (accepted) checks.push({ key: "entry", state: "met", label: "Your diploma is accepted", quote: accepted });
  else if (caseLine) checks.push({ key: "entry", state: "check", label: "Assessed case by case", quote: caseLine });
  else checks.push({ key: "entry", state: "not", label: "Your diploma isn't listed", quote: q.join(" · ") });

  // Field: a related-field rule, or simply a different subject.
  const fieldRule = t.fieldRequirement ?? has(q, /related|relevant/i);
  if (b.discipline && t.discipline !== "other") {
    if (b.discipline === t.discipline) checks.push({ key: "field", state: "met", label: "Same field", quote: fieldRule });
    else checks.push({ key: "field", state: fieldRule ? "not" : "check", label: fieldRule ? "Needs a related diploma" : "Different field", quote: fieldRule });
  }

  // English: a diploma taught in English usually counts; otherwise the IELTS minimum.
  const viaDiploma = has(t.english, /diploma|private education institution|polytechnic/i);
  if (viaDiploma) checks.push({ key: "english", state: "met", label: "English: your diploma counts", quote: viaDiploma });
  else if (t.ieltsMin != null && b.ielts != null)
    checks.push({ key: "english", state: b.ielts >= t.ieltsMin ? "met" : "not", label: `IELTS ${t.ieltsMin}`, quote: has(t.english, /ielts/i) });
  else if (t.english.length) checks.push({ key: "english", state: "check", label: t.ieltsMin != null ? `IELTS ${t.ieltsMin}` : "English test", quote: t.english[0] });

  // Student's Pass: it needs full-time study, so a part-time-only programme is out; a Murdoch single
  // major that is local only is open as a double major.
  if (b.studentPass && t.access === "part-time-only") checks.push({ key: "pass", state: "not", label: "Part-time only: not for a Student’s Pass", quote: t.accessQuote });
  else if (b.studentPass && t.access === "local-only" && t.doubleMajors.length)
    checks.push({ key: "pass", state: "check", label: "International: as a double major", quote: t.accessQuote });
  else if (b.studentPass && t.international === false) checks.push({ key: "pass", state: "not", label: "Local applicants only", quote: t.accessQuote });
  else if (b.studentPass && t.international) checks.push({ key: "pass", state: "met", label: "Open to Student’s Pass", quote: null });

  return checks;
}

export const overall = (checks: Check[]): CheckState =>
  checks.some((c) => c.state === "not") ? "not" : checks.some((c) => c.state === "check") ? "check" : "met";
