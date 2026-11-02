// Career value of an applicant's jobs and internships, as a bonus on the admission model's GPA scale
// (data/raw/admit-model.json). Not counted in years: each role is valued by
//   fit        how close the job's work is to the programme (data/raw/experience-fit.json, from what
//              admitted applicants to each discipline had done),
//   influence  the employer's standing in its industry (Fortune Global 500 2026 and named industry leaders),
//   level      the applicant's contribution in the role, read from the job title,
// with internships counted at INTERN_DISCOUNT. The best three roles add up with falling weights, and the
// programme's own weight for experience (EXPERIENCE_WEIGHT, by what its page asks for) turns that into GPA points.

import fortune from "@/data/raw/fortune-global-500-2026.json";
import fitData from "@/data/raw/experience-fit.json";
import { EXPERIENCE_WEIGHT, INTERN_DISCOUNT, type ExperienceClass } from "./admit-weights";

export { EXPERIENCE_WEIGHT, INTERN_DISCOUNT, type ExperienceClass };

export type Role = { title: string; employer: string; description?: string; internship?: boolean };
/** The best roles count 1, ½ and ¼; more roles add nothing. */
const ROLE_WEIGHTS = [1, 0.5, 0.25];
/** A score above this (a strong job plus a second role) is a full 1. */
const FULL_SCORE = 1.5;

const FUNCTIONS: Record<string, RegExp> = Object.fromEntries(
  Object.entries(fitData.functions as Record<string, string>).filter(([k]) => k !== "research").map(([k, v]) => [k, new RegExp(v, "i")]),
);

/** The kinds of work a role is, from its title and description. */
export const functionsOf = (r: Role): string[] => {
  const text = `${r.title} ${r.employer} ${r.description ?? ""}`;
  return Object.keys(FUNCTIONS).filter((k) => FUNCTIONS[k].test(text));
};

/** 0.2–1: the best fit of the role's kinds of work for the programme's discipline; 0.4 when unknown. */
export function fitOf(r: Role, discipline: string): number {
  const row = (fitData.fit as Record<string, Record<string, number>>)[discipline];
  const fs = functionsOf(r);
  if (!row || !fs.length) return 0.4;
  return Math.max(...fs.map((f) => row[f] ?? 0.4));
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9一-鿿]+/g, " ").trim();
const FORTUNE = new Set((fortune.companies as { name: string }[]).map((c) => norm(c.name)));
/** Industry leaders that the Fortune list leaves out or names differently (consulting, audit, investment banks, platforms, Singapore and Chinese leaders). */
const LEADERS = /麦肯锡|贝恩|波士顿咨询|埃森哲|德勤|普华|安永|毕马威|高盛|摩根|瑞银|花旗|汇丰|渣打|中金|中信证券|华泰|国泰君安|招商证券|腾讯|阿里|字节|华为|百度|京东|美团|网易|小米|星展|华侨银行|大华银行|淡马锡|新加坡航空|mckinsey|bain|boston consulting|\bbcg\b|accenture|deloitte|\bpwc\b|pricewaterhouse|\bey\b|ernst|kpmg|goldman|morgan stanley|j\.?p\.? ?morgan|ubs|citi|hsbc|standard chartered|blackrock|google|alphabet|meta|microsoft|apple|amazon|tencent|alibaba|bytedance|tiktok|huawei|\bdbs\b|ocbc|\buob\b|temasek|\bgic\b|singtel|capitaland|singapore airlines|st engineering|keppel|sembcorp|grab|shopee|sea group/i;
/** Signs of an established organisation below the leaders: listed groups, banks, public bodies, multinationals' regional offices. */
const ESTABLISHED = /集团|股份|上市|银行|证券|政府|人民|局|委员会|研究院|大学|医院|ministry|government|statutory|authority|bank|group|holdings|plc|limited|ltd|inc|corporation|university|hospital/i;

/** 0.5–1: the employer's standing in its industry. */
export function influenceOf(r: Role): number {
  const e = norm(r.employer);
  if (FORTUNE.has(e) || [...FORTUNE].some((f) => f.length > 4 && e.includes(f)) || LEADERS.test(r.employer)) return 1;
  if (ESTABLISHED.test(r.employer)) return 0.75;
  return 0.5;
}

/** 0.6–1.25: the applicant's contribution in the role, by its title. */
export function levelOf(r: Role): number {
  const t = r.title;
  if (/\b(ceo|cfo|coo|cto|founder|co-?founder|partner|president|owner)\b|创始人|合伙人|总经理|总裁|董事/i.test(t)) return 1.25;
  if (/\b(director|vp|vice president|head of)\b|总监|负责人/i.test(t)) return 1.15;
  if (/\b(manager|lead|supervisor)\b|经理|主管|组长/i.test(t)) return 1;
  if (/\b(senior|sr\.?|principal)\b|高级|资深/i.test(t)) return 0.85;
  if (/\b(assistant|clerk|admin)\b|助理|文员/i.test(t)) return 0.6;
  return 0.7; // analyst, associate, officer, executive, consultant, engineer, 专员, 分析师 …
}

export const isInternship = (r: Role) => r.internship ?? /\bintern(ship)?\b|实习/i.test(`${r.title} ${r.description ?? ""}`);

/** One role's value: fit × influence × level, internships discounted. */
export const roleValue = (r: Role, discipline: string) =>
  fitOf(r, discipline) * influenceOf(r) * levelOf(r) * (isInternship(r) ? INTERN_DISCOUNT : 1);

/** 0–1: the applicant's career score for a programme in this discipline. */
export function careerScore(roles: Role[], discipline: string): number {
  const v = roles.map((r) => roleValue(r, discipline)).sort((a, b) => b - a);
  const s = v.slice(0, ROLE_WEIGHTS.length).reduce((t, x, i) => t + x * ROLE_WEIGHTS[i], 0);
  return Math.min(1, s / FULL_SCORE);
}

/** The bonus on the admission model's GPA scale for this programme. */
export const experienceBonus = (roles: Role[], discipline: string, cls: ExperienceClass) =>
  careerScore(roles, discipline) * EXPERIENCE_WEIGHT[cls];
