import type { ChineseName } from "@/lib/results-types";

// Names of universities and programmes in the page's language: on the Chinese pages the Chinese name (the
// institution's own where it has one, else a translation, marked so), with the English name kept beside it,
// since applications use it.

export type LocalName = { name: string; en: string | null; translated: boolean };

export function localName(locale: string, en: string, zh: ChineseName | null): LocalName {
  return locale === "en" || !zh ? { name: en, en: null, translated: false } : { name: locale === "zh-hant" ? zh.hant : zh.hans, en, translated: !zh.official };
}
