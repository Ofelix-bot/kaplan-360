// Builds data/raw/kaplan-programmes.json: Kaplan Singapore's current diplomas and partner bachelor's
// degrees, from kaplan.com.sg (checked 2026-10-18) and the Degree Enrolment Day deck (9 Mar 2026).
// Run with: npm run data:kaplan
//
// The lists below were read from official Kaplan pages; edit them here, not in the JSON output.

import { writeFileSync } from "node:fs";

const OUT = new URL("../../data/raw/kaplan-programmes.json", import.meta.url);
const SITE = "https://www.kaplan.com.sg";

/** Matching disciplines: the 13 areas Kaplan's own programmes cover (decided 2026-10-18). */
const DISCIPLINES = {
  business: "Business & management",
  it: "IT & computing",
  "accounting-finance": "Accounting & finance",
  "psychology-counselling": "Psychology & counselling",
  marketing: "Marketing",
  communication: "Communication & media",
  "ai-data": "AI & data",
  "law-criminology": "Law & criminology",
  "hospitality-tourism": "Hospitality & tourism",
  education: "Education",
  "healthcare-nursing": "Healthcare & nursing",
  construction: "Construction & built environment",
  "sports-science": "Sports science",
};

// [name, discipline, slug]. Source: /academic-levels/diplomas-courses and each /diploma/<slug> page.
const DIPLOMAS = [
  ["Diploma in Accounting and Finance (Double Specialisation)", "accounting-finance", "diploma-in-accounting-and-finance"],
  ["Diploma in Accounting and Finance (E-Learning)", "accounting-finance", "diploma-accounting-and-finance-e-learning"],
  ["Diploma in Finance and Banking (Double Specialisation)", "accounting-finance", "diploma-in-finance-and-banking"],
  ["Diploma in Finance and Banking (E-Learning)", "accounting-finance", "diploma-in-finance-and-banking-e-learning"],
  ["Diploma in Finance and Business Analytics (Double Specialisation)", "accounting-finance", "diploma-in-finance-and-business-analytics"],
  ["Diploma in Fintech", "accounting-finance", "diploma-in-fintech"],
  ["Diploma in Artificial Intelligence and Data Science (Double Specialisation)", "ai-data", "diploma-in-artificial-intelligence-and-data-science"],
  ["Advanced Diploma in Management", "business", "advanced-diploma-in-management"],
  ["Diploma in Business Analytics", "business", "diploma-in-business-analytics"],
  ["Diploma in Business Management", "business", "diploma-in-business-management"],
  ["Diploma in Business Management (E-Learning)", "business", "diploma-in-business-management-e-learning"],
  ["Diploma in Business Management (General Studies)", "business", "diploma-in-business-management-general-studies"],
  ["Diploma in Business Management (General Studies) (E-Learning)", "business", "diploma-in-business-management-general-studies-e-learning"],
  ["Diploma in Digital Marketing", "marketing", "diploma-in-digital-marketing"],
  ["Diploma in Digital Marketing and Analytics (Double Specialisation)", "marketing", "diploma-in-digital-marketing-and-analytics"],
  ["Diploma in Human Resources and Management (Double Specialisation)", "business", "diploma-in-human-resources-and-management"],
  ["Diploma in Human Resources and Management (E-Learning)", "business", "diploma-in-human-resources-and-management-e-learning"],
  ["Diploma in Logistics and Supply Chain Management (Double Specialisation)", "business", "diploma-in-logistics-and-supply-chain-management"],
  ["Diploma in Logistics and Supply Chain Management (E-Learning)", "business", "diploma-in-logistics-and-supply-chain-management-e-learning"],
  ["Diploma in Marketing and Management (Double Specialisation)", "marketing", "diploma-in-marketing-and-management"],
  ["Diploma in Marketing and Management (E-Learning)", "marketing", "diploma-in-marketing-and-management-e-learning"],
  ["Diploma in Mass Communication", "communication", "diploma-in-mass-communication"],
  ["Diploma in Media Communication and Digital Marketing (Double Specialisation)", "communication", "diploma-in-media-communication-and-digital-marketing"],
  ["Diploma in Counselling", "psychology-counselling", "diploma-in-counselling"],
  ["Diploma in Counselling and Social Services (Double Specialisation)", "psychology-counselling", "diploma-in-counselling-and-social-services"],
  ["Diploma in Psychology", "psychology-counselling", "diploma-in-psychology"],
  ["Diploma in Psychology and Counselling (Double Specialisation)", "psychology-counselling", "diploma-in-psychology-and-counselling"],
  ["Diploma in Psychology and Criminology (Double Specialisation)", "psychology-counselling", "diploma-in-psychology-and-criminology"],
  ["Diploma in Psychology (E-Learning)", "psychology-counselling", "diploma-psychology-e-learning"],
  ["Diploma in Health Services and Management (Double Specialisation)", "healthcare-nursing", "diploma-in-health-services-and-management"],
  ["Diploma in Hospitality and Tourism Management (Double Specialisation)", "hospitality-tourism", "diploma-in-hospitality-and-tourism-management"],
  ["Diploma in Hospitality and Tourism Management (E-Learning)", "hospitality-tourism", "diploma-in-hospitality-and-tourism-management-e-learning"],
  ["Diploma in Cyber Forensics and Computer Science (Double Specialisation)", "it", "diploma-in-cyber-forensics-and-computer-science"],
  ["Diploma in Information Technology", "it", "diploma-in-information-technology"],
  ["Diploma in Information Technology (E-Learning)", "it", "diploma-information-technology-e-learning"],
  ["Diploma in Criminology", "law-criminology", "diploma-in-criminology"],
  ["Diploma in Legal Studies", "law-criminology", "diploma-in-legal-studies"],
  ["Diploma in Sports & Exercise Science", "sports-science", "diploma-in-sports-and-exercise-sports"],
];
// Awarding body confirmed on these pages; the rest are assumed KHEA (listing names no awarding body).
const KHEA_CONFIRMED = new Set(["diploma-in-business-management", "advanced-diploma-in-management"]);

// QS 2027 name, Student's Pass (deck p.15), Kaplan partner page.
const PARTNERS = {
  murdoch: { university: "Murdoch University", studentPass: true, url: `${SITE}/university/murdoch-university` },
  northumbria: { university: "Northumbria University at Newcastle", studentPass: true, url: `${SITE}/university/northumbria-university` },
  bcu: { university: "Birmingham City University", studentPass: false, url: `${SITE}/university/birmingham-city-university` },
  portsmouth: { university: "University of Portsmouth", studentPass: true, url: `${SITE}/university/university-portsmouth` },
  ucd: { university: "University College Dublin", studentPass: true, url: `${SITE}/university/university-college-dublin` },
  monash: { university: "Monash University", studentPass: false, url: `${SITE}/university/monash-university` },
};

// [partner, name, level, discipline, page?]. level: top-up | bachelor-advanced-standing | bachelor-direct-honours
const BACHELORS = [
  ["murdoch", "Bachelor of Business in Accounting", "bachelor-advanced-standing", "accounting-finance"],
  ["murdoch", "Bachelor of Business in Banking", "bachelor-advanced-standing", "accounting-finance"],
  ["murdoch", "Bachelor of Business in Finance", "bachelor-advanced-standing", "accounting-finance"],
  ["murdoch", "Bachelor of Business in Business Law", "bachelor-advanced-standing", "law-criminology"],
  ["murdoch", "Bachelor of Business in Human Resources Management", "bachelor-advanced-standing", "business"],
  ["murdoch", "Bachelor of Business in International Business", "bachelor-advanced-standing", "business"],
  ["murdoch", "Bachelor of Business in Management", "bachelor-advanced-standing", "business"],
  ["murdoch", "Bachelor of Business in Marketing", "bachelor-advanced-standing", "marketing"],
  ["murdoch", "Bachelor of Business in Hospitality and Tourism Management", "bachelor-advanced-standing", "hospitality-tourism"],
  ["murdoch", "Bachelor of Communication in Communication and Media Studies", "bachelor-advanced-standing", "communication"],
  ["murdoch", "Bachelor of Communication in Digital Communication", "bachelor-advanced-standing", "communication"],
  ["murdoch", "Bachelor of Communication in Strategic Communication", "bachelor-advanced-standing", "communication"],
  ["murdoch", "Bachelor of Information Technology in Artificial Intelligence and Autonomous Systems", "bachelor-advanced-standing", "it"],
  ["murdoch", "Bachelor of Information Technology in Business Information Systems", "bachelor-advanced-standing", "it"],
  ["murdoch", "Bachelor of Information Technology in Computer Science", "bachelor-advanced-standing", "it"],
  ["murdoch", "Bachelor of Information Technology in Cyber Security and Forensics", "bachelor-advanced-standing", "it"],
  ["murdoch", "Bachelor of Information Technology in Games Design and Development", "bachelor-advanced-standing", "it"],
  ["murdoch", "Bachelor of Data Analytics in Business Intelligence", "bachelor-advanced-standing", "ai-data"],
  ["murdoch", "Bachelor of Data Analytics in Data Science", "bachelor-advanced-standing", "ai-data"],
  ["murdoch", "Bachelor of Data Analytics in FinTech (Minor in Information Security Systems)", "bachelor-advanced-standing", "ai-data"],
  ["murdoch", "Bachelor of Psychology in Psychological Science", "bachelor-advanced-standing", "psychology-counselling"],
  ["murdoch", "Bachelor of Criminology in Criminal Behaviour", "bachelor-advanced-standing", "law-criminology"],
  ["northumbria", "BSc (Hons) Global Business Management", "bachelor-direct-honours", "business"],
  ["northumbria", "BSc (Hons) Global Business Management (Logistics and Supply Chain)", "bachelor-direct-honours", "business"],
  ["northumbria", "BSc (Hons) Global Business Management (Human Resources)", "bachelor-direct-honours", "business"],
  ["northumbria", "BSc (Hons) International Tourism, Hospitality and Events", "bachelor-direct-honours", "hospitality-tourism"],
  ["northumbria", "BA (Hons) Mass Communication with Public Relations (Top-up)", "top-up", "communication"],
  ["northumbria", "BA (Hons) in Childhood and Early Years Studies (Top-up)", "top-up", "education"],
  ["northumbria", "BA (Hons) in Guidance and Counselling (Top-up)", "top-up", "psychology-counselling"],
  ["northumbria", "BSc (Hons) in Psychology (Clinical Psychology) (Top-up)", "top-up", "psychology-counselling"],
  ["northumbria", "Bachelor of Science Nursing (Top-up) for Registered Nurses", "top-up", "healthcare-nursing"],
  ["bcu", "BA (Hons) Business Administration (Top-up)", "top-up", "business"],
  ["bcu", "BA (Hons) International Marketing (Top-up)", "top-up", "marketing"],
  ["bcu", "BA (Hons) in International Business (Top-up)", "top-up", "business"],
  ["bcu", "BA with Honours Digital Marketing (Top-up)", "top-up", "marketing"],
  ["bcu", "BSc with Honours Construction Management (Top-up)", "top-up", "construction"],
  ["bcu", "Bachelor of Laws (Honours) (Top-up)", "top-up", "law-criminology"],
  ["bcu", "BSc with Honours Computer Science (Global) (Top-up)", "top-up", "it"],
  ["bcu", "BSc with Honours Computer Science with Artificial Intelligence (Global) (Top-up)", "top-up", "it"],
  ["bcu", "BSc with Honours Cyber Security (Global) (Top-up)", "top-up", "it"],
  ["bcu", "BSc with Honours Digital Forensics (Global) (Top-up)", "top-up", "it"],
  ["portsmouth", "BA (Hons) in Accountancy and Financial Management (Top-up)", "top-up", "accounting-finance"],
  ["portsmouth", "BSc (Hons) Computer Science (Top-up)", "top-up", "it"],
  ["portsmouth", "BSc (Hons) Cyber Security and Forensic Computing (Top-up)", "top-up", "it"],
  ["portsmouth", "BSc (Hons) Data Science and Analytics (Top-up)", "top-up", "ai-data"],
  ["portsmouth", "BSc with Honours in Psychology (Top-up)", "top-up", "psychology-counselling"],
  ...[
    ["Business Analytics", "business"],
    ["Digital Business", "business"],
    ["FinTech", "accounting-finance"],
    ["Finance", "accounting-finance"],
    ["Human Resource Management", "business"],
    ["Logistics and Supply Chain Management", "business"],
    ["Management", "business"],
    ["Marketing", "marketing"],
    ["Project Management", "business"],
  ].map(([spec, d]) => ["ucd", `Bachelor of Business Studies (Honours) (${spec}) (Top-up)`, "top-up", d]),
  ["monash", "Bachelor of Education in Early Childhood (Top-up)", "top-up", "education"],
];

// Facts from the deck that attach to specific bachelor's programmes.
const DECK = "kaplan-ded-2026-03-09-cn";
const NOT_OFFERED_THIS_INTAKE = new Set([
  "BSc (Hons) Global Business Management (Logistics and Supply Chain)",
  "BSc (Hons) Global Business Management (Human Resources)",
]);

const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const programmes = [
  ...DIPLOMAS.map(([name, discipline, s]) => ({
    id: `kaplan-${s}`,
    name,
    level: name.startsWith("Advanced") ? "advanced-diploma" : "diploma",
    discipline,
    awardingBody: "Kaplan Higher Education Academy",
    awardingBodyVerified: KHEA_CONFIRMED.has(s),
    university: null,
    studentPass: null, // not stated per diploma
    mode: /E-Learning/.test(name) ? "e-learning" : null,
    sourceUrl: `${SITE}/diploma/${s}`,
    sources: ["kaplan-website"],
  })),
  ...BACHELORS.map(([p, name, level, discipline]) => {
    const partner = PARTNERS[p];
    return {
      id: `${p}-${slug(name)}`,
      name,
      level,
      discipline,
      awardingBody: partner.university,
      awardingBodyVerified: true,
      university: partner.university,
      studentPass: partner.studentPass,
      mode: null,
      offeredThisIntake: NOT_OFFERED_THIS_INTAKE.has(name) ? false : undefined,
      sourceUrl: partner.url,
      sources: ["kaplan-website", ...(partner.studentPass ? [DECK] : [])],
    };
  }),
];

const count = (key) => Object.fromEntries(
  Object.entries(programmes.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {})).sort(),
);

const out = {
  dataset: "Kaplan Singapore programmes (diplomas and partner bachelor's degrees)",
  builtAt: new Date().toLocaleDateString("sv-SE"),
  sources: {
    "kaplan-website": { name: "kaplan.com.sg programme listings and partner pages", url: `${SITE}/academic-levels/diplomas-courses`, checkedAt: "2026-10-18" },
    [DECK]: { name: "Kaplan Degree Enrolment Day deck (Chinese), 9 March 2026", file: "data/raw/kaplan-degree-enrolment-day-2026-03.json" },
  },
  notes: [
    "Murdoch also offers many double-major combinations (Kaplan: \"over 200 degree options\"). They are not listed one by one: a student picks two single majors. Families and direct-entry pathways are in the deck file (murdochDoubleMajors, murdochDirectEntry).",
    "studentPass: true = open to international students on a Student's Pass (deck p.15 lists Murdoch, UCD, Northumbria and Portsmouth). false = not listed for Student's Pass holders in the deck. Diplomas: not stated per programme.",
    "awardingBodyVerified: false = the diploma page names no awarding body; assumed Kaplan Higher Education Academy.",
    "The official 2026 programme and module list PDF linked from /programme-directory returned 404 on 2026-10-18, so the counts could not be checked against it.",
    "Four Foundation Diplomas (pre-diploma) are not included.",
  ],
  disciplines: DISCIPLINES,
  counts: { total: programmes.length, byLevel: count("level"), byDiscipline: count("discipline") },
  programmes,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out.counts));
