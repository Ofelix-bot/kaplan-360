import { msg } from "@/lib/i18n/translate";
import type { ResultsProgramme } from "@/lib/results-types";

// The Programme finder's master's directions: three groups, each direction read from the programme's
// Kaplan discipline (data/raw/kaplan-programmes.json) or from words in its name. A programme can be in
// more than one direction ("MSc Sustainable Finance" is Finance and Sustainability / ESG).

export type Direction = { id: string; label: string; test: (p: Pick<ResultsProgramme, "name" | "discipline">) => boolean };
export type DirectionGroup = { label: string; items: Direction[] };

const named = (re: RegExp) => (p: Pick<ResultsProgramme, "name">) => re.test(p.name);

export const DIRECTION_GROUPS: DirectionGroup[] = [
  {
    label: msg("Business and finance"),
    items: [
      { id: "finance", label: msg("Finance"), test: named(/financ|banking|\binvestment|fintech|actuar|wealth management|(?<!built )asset management|risk management|quantitative finance/i) },
      { id: "accounting", label: msg("Accounting"), test: named(/accounting|accountancy|\baudit|taxation/i) },
      {
        id: "management",
        label: msg("Management"),
        // A business programme, or an MBA anywhere ("Construction Management" stays with construction).
        test: (p) => (p.discipline === "business" && !/marketing/i.test(p.name)) || /\bMBA\b|business administration/i.test(p.name),
      },
      { id: "marketing", label: msg("Marketing"), test: (p) => p.discipline === "marketing" || /marketing|\bbrand|advertising|consumer/i.test(p.name) },
      { id: "esg", label: msg("Sustainability / ESG"), test: named(/sustainab|\bESG\b|\bgreen\b|climate|carbon|circular economy|environmental (?:management|policy|economics|governance)|energy (?:transition|policy|management)|responsible (?:business|management)/i) },
    ],
  },
  {
    label: msg("Technology and data"),
    items: [
      {
        id: "computing",
        label: msg("Computing"),
        test: (p) => (p.discipline === "it" && !/data|analytics/i.test(p.name)) || /computer|computing|software|information (?:technology|systems)|cyber|network/i.test(p.name),
      },
      { id: "data", label: msg("Data science"), test: named(/\bdata\b|analytics|statistic/i) },
      { id: "ai", label: msg("Artificial intelligence"), test: named(/artificial intelligence|\bAI\b|machine learning|deep learning|robotics|intelligent systems/i) },
    ],
  },
  {
    label: msg("Humanities and social sciences"),
    items: [
      // Communication programmes other than translation and linguistics, which share that discipline.
      { id: "media", label: msg("Media"), test: (p) => (p.discipline === "communication" && !/translat|interpret|linguist/i.test(p.name)) || /\bmedia\b|journalism|film|broadcast|public relations/i.test(p.name) },
      { id: "psychology", label: msg("Psychology"), test: (p) => p.discipline === "psychology-counselling" || /psycholog|counsel/i.test(p.name) },
      { id: "education", label: msg("Education"), test: (p) => p.discipline === "education" || /\beducation|teaching|\bTESOL\b/i.test(p.name) },
      {
        id: "ir",
        label: msg("International relations"),
        test: named(/international relations|international affairs|global affairs|diplomacy|international politics|international studies|global governance|international security|public policy/i),
      },
    ],
  },
];

export const DIRECTIONS: Direction[] = DIRECTION_GROUPS.flatMap((g) => g.items);
export const MAX_DIRECTIONS = 3;

export const directionLabel = (id: string) => DIRECTIONS.find((d) => d.id === id)?.label ?? id;

/** In any of the chosen directions (none chosen: every programme). */
export const inDirections = (p: Pick<ResultsProgramme, "name" | "discipline">, ids: string[]) => !ids.length || DIRECTIONS.some((d) => ids.includes(d.id) && d.test(p));

/** Directions named in a sentence ("想读金融或者可持续方向的硕士"), for the one-sentence reader. */
const SAID: [string, RegExp][] = [
  ["finance", /金融|finance|financial|banking/i],
  ["accounting", /会计|會計|accounting|accountancy/i],
  ["management", /管理|management|\bMBA\b/i],
  ["marketing", /市场营销|市場營銷|营销|marketing/i],
  ["esg", /可持续|可持續|\bESG\b|sustainab|绿色|綠色|climate|气候/i],
  ["computing", /计算机|計算機|computer|computing|software|软件/i],
  ["data", /数据|數據|\bdata\b|analytics/i],
  ["ai", /人工智能|\bAI\b|artificial intelligence|machine learning/i],
  ["media", /传媒|傳媒|媒体|media|communication/i],
  ["psychology", /心理|psycholog/i],
  ["education", /教育|education|teaching/i],
  ["ir", /国际关系|國際關係|international relations|diplomacy/i],
];

/** Directions the master's part of a sentence names: after "想读 / 想去 / master's in …", else the whole sentence. */
export function directionsSaid(text: string): string[] {
  const m = /(?:想读|想讀|想申请|想申請|方向|master'?s? (?:in|of)|study|硕士|碩士)([\s\S]*)/i.exec(text);
  const part = m ? m[0] : text;
  return SAID.filter(([, re]) => re.test(part)).map(([id]) => id).slice(0, MAX_DIRECTIONS);
}
