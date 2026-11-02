import names from "@/data/raw/chinese-site-names.json";
import { localName, type LocalName } from "@/lib/local-name";
import type { ChineseName } from "@/lib/results-types";

// Names the site's data files give as English text, with no id: universities and schools (partners, top-up
// providers, Singapore schools, any university in the database by its English name) and Kaplan's and the top-up
// degrees, in the page's language (scripts/pipeline/chinese-names.ts, step 4).

const SITE = names as unknown as { schools: Record<string, ChineseName>; degrees: Record<string, ChineseName> };

export const schoolName = (locale: string, en: string): LocalName => localName(locale, en, SITE.schools[en.trim()] ?? null);
export const degreeName = (locale: string, en: string): LocalName => localName(locale, en, SITE.degrees[en.trim()] ?? null);
