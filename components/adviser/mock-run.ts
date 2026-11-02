import type { AuditResponse, Final } from "@/lib/agent/types";
import type { AdviserEvent, CaseResult, IntakeResult } from "@/lib/adviser/types";
import type { Recording } from "./use-adviser";

// ?mock=1 on /adviser: a hand-written run for Arjun (an Indian student on a Student's Pass, Murdoch business top-up at
// Kaplan, fintech in Singapore, 400,000 CNY in total) so the four steps can be shown without the model. Figures here
// are illustrative only; the page never shows this outside ?mock=1.

const UCD = "university-college-dublin-master-of-science-global-finance-kaplan-singapore";
const MURDOCH_MBA = "murdoch-university-master-of-business-administration-kaplan-singapore";
const MONASH = "monash-university-master-of-professional-accounting";
const ROLE = "know-your-customer-customer-due-diligence-analyst";

const intake: IntakeResult = {
  you: [
    { text: "Student’s Pass, Indian national", sources: [] },
    { text: "Murdoch business top-up at Kaplan, ends December 2026", sources: [] },
    { text: "GPA 3.2, IELTS 6.5", sources: [] },
    { text: "Goal: fintech in Singapore; budget 400,000 CNY in total", sources: [] },
  ],
  goal: "Whether to take a master’s first or start work in Singapore fintech after December 2026.",
  questions: [{ id: "q1", question: "If a Singapore job offer came before a master’s place, would your parents accept work first?", options: ["Yes, if the job is in finance", "Only with a master’s later", "No, master’s first"] }],
};

const study: CaseResult = {
  side: "study",
  thesis: { text: "A one-year Singapore master’s in finance lifts Arjun into the Employment Pass band before his Student’s Pass runs out.", sources: [{ kind: "ep", id: "ep" }] },
  points: [
    { criterion: "cost", claim: { text: "UCD’s MSc Global Finance at Kaplan fits inside the 400,000 CNY budget with room for living costs.", sources: [{ kind: "programme", id: UCD, field: "fee" }] } },
    { criterion: "benefit", claim: { text: "A master’s raises the qualifying salary story for an Employment Pass in financial services.", sources: [{ kind: "ep", id: "ep" }] } },
    { criterion: "risk", claim: { text: "Another year of fees with no Singapore work experience on the CV.", sources: [] } },
    { criterion: "fit", claim: { text: "His GPA 3.2 sits in the band UCD usually admits.", sources: [{ kind: "programme", id: UCD, field: "entry" }] } },
  ],
  concede: { text: "Fintech employers often value a year of work over a second business degree.", sources: [{ kind: "career", id: ROLE }] },
  conditions: ["A fintech offer at or above the Employment Pass salary arrives before March 2027", "The family budget drops below the master’s total"],
  picks: [
    { programmeId: UCD, reason: "Finance master’s taught at Kaplan Singapore, January intake" },
    { programmeId: MURDOCH_MBA, reason: "Same awarding university as his degree" },
  ],
  roles: [{ roleId: ROLE, reason: "Entry route into fintech compliance" }],
  calls: [{ tool: "search_programmes", input: { directions: ["finance"], regions: ["sg"] } }],
};

const work: CaseResult = {
  side: "work",
  thesis: { text: "Start in a fintech compliance role in 2027 and take a part-time master’s once the Employment Pass is secured.", sources: [{ kind: "career", id: ROLE }] },
  points: [
    { criterion: "cost", claim: { text: "Work first earns a salary instead of spending most of the 400,000 CNY budget.", sources: [{ kind: "employment", id: "sg-pei-2024-25-salary" }] } },
    { criterion: "benefit", claim: { text: "KYC analyst roles are among the in-demand financial services roles in Singapore.", sources: [{ kind: "career", id: ROLE }] } },
    { criterion: "risk", claim: { text: "An international graduate needs an employer willing to apply for an Employment Pass.", sources: [{ kind: "ep", id: "ep" }] } },
    { criterion: "fit", claim: { text: "His business degree covers most of the KYC role’s listed skills.", sources: [{ kind: "career", id: ROLE }] } },
  ],
  concede: { text: "Without an offer by the time his pass ends, he would have to leave Singapore.", sources: [{ kind: "ep", id: "ep" }] },
  conditions: ["No interview by February 2027", "Parents will not fund a later master’s"],
  picks: [{ programmeId: MONASH, reason: "Part-time route to an accounting credential later" }],
  roles: [{ roleId: ROLE, reason: "Closest in-demand role to his degree" }],
  calls: [{ tool: "hot_roles", input: { industry: "financial-services" } }],
};

const final: Final = {
  analysis: {
    you: intake.you,
    education: [study.thesis, study.points[0].claim],
    career: [work.thesis, work.points[1].claim],
  },
  decision: {
    rows: [
      { criterion: "cost", study: study.points[0].claim, work: work.points[0].claim },
      { criterion: "benefit", study: study.points[1].claim, work: work.points[1].claim },
      { criterion: "risk", study: study.points[2].claim, work: work.points[2].claim },
      { criterion: "fit", study: study.points[3].claim, work: work.points[3].claim },
    ],
    lean: "both",
    why: { text: "Apply for fintech roles from January 2027 while holding a master’s offer as the fallback; the job decides which comes first.", sources: [{ kind: "ep", id: "ep" }, { kind: "career", id: ROLE }] },
  },
  roadmap: [
    { when: "2026-11", lane: "education", text: "Apply to UCD MSc Global Finance at Kaplan for the January intake" },
    { when: "2026-12", lane: "career", text: "Apply to five KYC and onboarding analyst roles at Singapore banks and fintechs" },
    { when: "2027-01", lane: "career", text: "Finish a short AML/KYC course to close the compliance gap" },
    { when: "2027-03", lane: "education", text: "Decide: accept the job and defer the master’s, or start the master’s" },
  ],
  gaps: [
    { roleId: ROLE, role: "KYC / CDD Analyst", skill: "Regulatory compliance", level: 3, fix: "degree", how: "Murdoch’s business law unit covers the basics" },
    { roleId: ROLE, role: "KYC / CDD Analyst", skill: "AML screening tools", level: 2, fix: "outside", how: "A short IBF-accredited AML course" },
  ],
  picks: [study.picks[0], study.picks[1]],
};

const audit: AuditResponse = {
  blocked: false,
  verdicts: final.decision.rows
    .flatMap((r) => [r.study, r.work])
    .concat(final.decision.why)
    .map((c) => ({ claim: c.text, status: "supported" as const, quote: null, url: null, note: "" })),
};

const think = (agent: AdviserEvent["agent"], ...parts: string[]): AdviserEvent[] => parts.map((text) => ({ type: "thinking", agent, text }));

export const MOCK_RUN: Recording = {
  recordedAt: "mock",
  stages: {
    intake: [
      ...think("intake", "Reading Arjun’s profile: ", "Student’s Pass, Murdoch top-up, ", "fintech goal."),
      { type: "tool", agent: "intake", id: "i1", tool: "ep_check", lane: "you", summary: "Student’s Pass ends with the course; work needs an Employment Pass", sources: 1, ms: 240, status: "done" },
      { type: "result", agent: "intake", data: intake },
    ],
    study: [
      ...think("study", "Looking for Singapore finance master’s ", "that fit 400,000 CNY in total."),
      { type: "tool", agent: "study", id: "s1", tool: "search_programmes", lane: "education", summary: "12 finance master’s in Singapore within budget", sources: 12, ms: 610, status: "done" },
      ...think("study", "Checking his admission match at UCD."),
      { type: "tool", agent: "study", id: "s2", tool: "admit_rate", lane: "education", summary: "GPA 3.2 sits in UCD’s usual band", sources: 2, ms: 330, status: "done" },
      { type: "result", agent: "study", data: study },
    ],
    work: [
      ...think("work", "Which fintech roles are hiring ", "graduates with a business degree?"),
      { type: "tool", agent: "work", id: "w1", tool: "hot_roles", lane: "career", summary: "KYC / CDD analyst is in demand in financial services", sources: 3, ms: 420, status: "done" },
      { type: "tool", agent: "work", id: "w2", tool: "skill_gap", lane: "career", summary: "2 of 9 listed skills not covered by his degree", sources: 1, ms: 280, status: "done" },
      { type: "tool", agent: "work", id: "w3", tool: "ep_check", lane: "career", summary: "Employment Pass needs an employer to apply", sources: 1, ms: 190, status: "done" },
      { type: "result", agent: "work", data: work },
    ],
    judge: [
      ...think("judge", "Weighing cost, benefit, risk and fit ", "for both roads."),
      { type: "tool", agent: "judge", id: "j1", tool: "compare_roads", lane: "you", summary: "Compared total cost and first-year income", sources: 4, ms: 510, status: "done" },
      { type: "result", agent: "judge", data: final },
    ],
    audit: [{ type: "result", agent: "audit", data: audit }],
  },
  questionsAnswered: [{ id: "q1", answer: "Yes, if the job is in finance" }],
};

