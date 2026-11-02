import policy from "@/data/raw/policy-risks.json";
import { msg } from "@/lib/i18n/translate";

// The visa rules that depend on the student's nationality (data/raw/policy-risks.json), shown on a Programme finder
// card when the programme has the rule (ResultsProgramme.risks, from the admission model's policy risks) and the
// nationality on /profile is one it covers. ATAS lists who is exempt; the travel ban and the China STEM notice list
// who is covered.

export const NATIONAL_RISKS = ["us-travel-ban", "uk-atas", "us-china-stem"];

/** The ATAS exemptions: EU/EEA, Switzerland, Australia, Canada, Japan, New Zealand, Singapore, South Korea, the US. */
const ATAS_EXEMPT = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "CH", "AU", "CA", "JP", "NZ", "SG", "KR", "US",
]);

type Rule = { id: string; nationalities: string[] | string | null; sources: string[]; level: string };
const RULES = new Map((policy.rules as Rule[]).filter((r) => NATIONAL_RISKS.includes(r.id)).map((r) => [r.id, r]));

const LABEL: Record<string, string> = {
  "us-travel-ban": msg("US travel ban: your nationality is on the list"),
  "uk-atas": msg("UK ATAS certificate: check the subject; your nationality isn’t exempt"),
  "us-china-stem": msg("US visa checks on Chinese students in STEM"),
};

export type NationalRisk = { id: string; label: string; url: string | null; block: boolean };

/** The programme's rules that cover this nationality (ISO code). */
export function risksFor(ids: string[] | undefined, nationality: string | null): NationalRisk[] {
  if (!ids?.length || !nationality) return [];
  return ids.flatMap((id) => {
    const r = RULES.get(id);
    if (!r) return [];
    const covered = id === "uk-atas" ? !ATAS_EXEMPT.has(nationality) : Array.isArray(r.nationalities) && r.nationalities.includes(nationality);
    return covered ? [{ id, label: LABEL[id], url: r.sources[0] ?? null, block: r.level === "block" }] : [];
  });
}
