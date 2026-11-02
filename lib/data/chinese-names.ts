import chineseNames from "@/data/raw/chinese-names.json";
import type { ChineseName } from "@/lib/results-types";

/** Chinese names for the Chinese pages (scripts/pipeline/chinese-names.ts), by university and programme id. */
const ZH = chineseNames as unknown as { universities: Record<string, ChineseName>; programmes: Record<string, ChineseName> };
const pick = (x: ChineseName | undefined): ChineseName | null => (x ? { hans: x.hans, hant: x.hant, official: x.official } : null);

export const universityZh = (id: string) => pick(ZH.universities[id]);
export const programmeZh = (id: string) => pick(ZH.programmes[id]);
