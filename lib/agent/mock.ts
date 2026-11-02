import type { AuditResponse, Final, StepRequest, StepResponse, ToolCall, TraceEntry } from "@/lib/agent/types";

// A recorded-style run for building and checking the adviser's page without the server half (lib/agent/client.ts
// uses it with ?mock=1 or NEXT_PUBLIC_AGENT_MOCK=1). It follows the contract exactly: an EP check, a programme search,
// an admission check, a question, the careers tools, a save to the plan, then finish; the first audit blocks one
// claim (a 2023 survey figure where the 2024 one is on file: a real "out of date" catch) and the rewrite passes. The
// figures and quotes are the site's own (EP table, data/raw/employment.json); the programmes are made up.

const call = (id: string, name: ToolCall["name"], input: Record<string, unknown> = {}): ToolCall => ({ id, name, input });
const done = (id: string, tool: TraceEntry["tool"], lane: TraceEntry["lane"], summary: string, sources: number, ms: number): TraceEntry => ({ id, tool, lane, summary, sources, ms, status: "done" });

const FINAL: Final = {
  analysis: {
    you: [
      { text: "Murdoch business top-up, graduating December 2026, on a Student's Pass: a job in Singapore needs an Employment Pass.", sources: [{ kind: "ep", id: "ep" }] },
      { text: "Your IELTS was taken in March 2025, so it is still valid for a September 2027 start.", sources: [] },
    ],
    education: [
      { text: "3 one-year business analytics master's fit your budget; your match is within the admitted range at all three.", sources: [{ kind: "programme", id: "mock-ucd-msc-business-analytics", field: "range" }] },
    ],
    career: [
      { text: "Fintech analyst roles list 17 skills; your degree covers 4 of them.", sources: [{ kind: "career", id: "fintech-analyst" }] },
      { text: "Private-degree graduates' median starting pay was S$3,500 (2024/25), below the S$5,600 EP floor at 23.", sources: [{ kind: "employment", id: "sg-pei-2024-25-salary" }, { kind: "ep", id: "ep" }] },
    ],
  },
  decision: {
    rows: [
      { criterion: "cost", study: { text: "Tuition within your 400,000 RMB budget at all three picks.", sources: [] }, work: { text: "No tuition; you earn from 2027.", sources: [] } },
      { criterion: "benefit", study: { text: "In Ireland, 84.6% of taught master's graduates were in employment nine months on, against 74.9% after a bachelor's.", sources: [{ kind: "employment", id: "ie-pgt-2024-employed" }] }, work: { text: "Two years of work raise your match at the same master's later.", sources: [] } },
      { criterion: "risk", study: { text: "A September 2027 start leaves a 9-month gap after graduation.", sources: [] }, work: { text: "A first job at S$3,500 would not pass the S$5,600 EP floor.", sources: [{ kind: "ep", id: "ep" }] } },
      { criterion: "fit", study: { text: "Analytics modules close 3 of your 13 fintech skill gaps.", sources: [] }, work: { text: "Marketing roles fit your degree better than fintech today.", sources: [] } },
    ],
    lean: "study",
    why: { text: "The EP salary floor is the deciding fact: a master's in analytics is the shorter road to a fintech job that passes it.", sources: [{ kind: "ep", id: "ep" }] },
  },
  roadmap: [
    { when: "2026-11", lane: "education", text: "Read the three programmes' official entry pages and note the deadlines." },
    { when: "2026-12", lane: "career", text: "Take the Financial Analytics elective's online equivalent before graduation." },
    { when: "2027-01", lane: "education", text: "Apply to UCD and one other pick in the first round." },
    { when: "2027-03", lane: "career", text: "Look for a 3-month analytics internship before the master's starts." },
  ],
  gaps: [
    { roleId: "fintech-analyst", role: "Fintech analyst", skill: "Data analytics", level: 3, fix: "outside", how: "The analytics master's covers it." },
    { roleId: "fintech-analyst", role: "Fintech analyst", skill: "Financial modelling", level: 3, fix: "degree", how: "An elective in your own degree covers it." },
    { roleId: "fintech-analyst", role: "Fintech analyst", skill: "Regulatory compliance", level: 2, fix: "outside", how: "A short MAS-recognised course." },
  ],
  picks: [
    { programmeId: "mock-ucd-msc-business-analytics", reason: "One year, within budget, match within the admitted range." },
    { programmeId: "mock-tcd-msc-business-analytics", reason: "One year; a stronger fintech employer link." },
    { programmeId: "mock-monash-master-of-business-analytics", reason: "Two years, but closest to the fintech skills you lack." },
  ],
};

/** The run, step by step: each entry is what /api/agent/step would answer to the n-th request. */
const STEPS: Omit<StepResponse, "messages" | "step">[] = [
  { calls: [call("t1", "ep_check")], trace: [], final: null },
  {
    calls: [call("t2", "outcomes_figures"), call("t3", "search_programmes", { countries: ["Ireland", "Australia"], direction: "analytics", maxMonths: 24 })],
    trace: [done("t1", "ep_check", "career", "Student's Pass → an Employment Pass is needed; floor S$5,600 at 23 (S$6,000 from 2027)", 1, 640)],
    final: null,
  },
  {
    calls: [call("t4", "admit_rate", { programmeId: "mock-ucd-msc-business-analytics" })],
    trace: [
      done("t2", "outcomes_figures", "career", "Private degrees: 78.9% found a job, median S$3,500; public universities: 88.9%, S$4,500", 4, 210),
      done("t3", "search_programmes", "education", "Ireland and Australia, analytics, ≤ 24 months: 18 programmes, 6 within budget", 6, 1830),
    ],
    final: null,
  },
  {
    calls: [call("t5", "ask_user", { question: "When did you take IELTS? If it was before November 2024, it will have expired by a 2027 start.", options: ["2025 or later", "Before November 2024", "Not taken yet"] })],
    trace: [done("t4", "admit_rate", "education", "UCD MSc Business Analytics: within the admitted range; 2 years of work would make it strong", 3, 920)],
    final: null,
  },
  { calls: [call("t6", "hot_roles", { industry: "financial-services" }), call("t7", "skill_gap", { roleId: "fintech-analyst" })], trace: [], final: null },
  {
    calls: [call("t8", "save_to_plan", { programmeIds: FINAL.picks.map((p) => p.programmeId), gaps: FINAL.gaps })],
    trace: [
      done("t6", "hot_roles", "career", "Financial services: 6 hot roles; fintech analyst is the closest to your degree", 5, 760),
      done("t7", "skill_gap", "career", "Fintech analyst: your degree covers 4 of 17 skills; 1 gap an elective closes", 2, 540),
    ],
    final: null,
  },
  { calls: [call("t9", "finish", FINAL as unknown as Record<string, unknown>)], trace: [], final: FINAL },
  {
    // The rewrite after the audit: the Irish figure now comes from the Class of 2024.
    calls: [call("t10", "finish")],
    trace: [],
    final: {
      ...FINAL,
      decision: {
        ...FINAL.decision,
        rows: FINAL.decision.rows.map((r) =>
          r.criterion === "benefit"
            ? { ...r, study: { text: "In Ireland, 86.6% of taught master's graduates (Class of 2024) were in employment nine months on, against 74.9% after a bachelor's.", sources: [{ kind: "employment", id: "ie-pgt-2024-employed" }] } }
            : r,
        ),
      },
    },
  },
];
STEPS[STEPS.length - 1].calls[0].input = STEPS[STEPS.length - 1].final as unknown as Record<string, unknown>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockStep(req: StepRequest): Promise<StepResponse> {
  const n = req.messages.length / 2;
  await wait(700 + Math.random() * 700);
  const s = STEPS[Math.min(n, STEPS.length - 1)];
  return { ...s, messages: [...req.messages, { role: "user", content: "·" }, { role: "assistant", content: "·" }], step: n + 1 };
}

let audits = 0;
export async function mockAudit(): Promise<AuditResponse> {
  await wait(1400);
  audits += 1;
  if (audits % 2 === 1)
    return {
      blocked: true,
      verdicts: [
        {
          claim: "In Ireland, 84.6% of taught master's graduates were in employment nine months on",
          status: "stale",
          quote: "86.6% of 2024 Postgraduate Taught Graduates were in employment nine months after graduation, up from 84.6% (2023 Graduates) but down from 89.3% (Class of 2022).",
          url: "https://hea.ie/statistics/graduate-outcomes/key-findings-go-2024/",
          note: "84.6% is the Class of 2023; the latest survey (Class of 2024) states 86.6%.",
        },
        { claim: "S$5,600 EP floor at 23", status: "supported", quote: "$5,600", url: "https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility", note: "" },
      ],
    };
  return {
    blocked: false,
    verdicts: [
      { claim: "86.6% of taught master's graduates (Class of 2024) were in employment nine months on", status: "supported", quote: "86.6% of 2024 Postgraduate Taught Graduates were in employment nine months after graduation", url: "https://hea.ie/statistics/graduate-outcomes/key-findings-go-2024/", note: "" },
      { claim: "S$5,600 EP floor at 23", status: "supported", quote: "$5,600", url: "https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility", note: "" },
    ],
  };
}
