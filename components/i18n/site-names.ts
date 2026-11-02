"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/i18n/I18nProvider";
import { degreeName, schoolName } from "@/lib/site-names";

/** lib/site-names.ts for the page's language: `school(en).name`, `degree(en).name`, with the English kept as `.en`. */
export function useSiteNames() {
  const locale = useLocale();
  return useMemo(() => ({ school: (en: string) => schoolName(locale, en), degree: (en: string) => degreeName(locale, en) }), [locale]);
}
