"use client";

import { useCallback } from "react";
import { useLocale } from "@/components/i18n/I18nProvider";
import { localName } from "@/lib/local-name";
import type { ChineseName } from "@/lib/results-types";

/** lib/local-name.ts for the page's language. */
export function useLocalName() {
  const locale = useLocale();
  return useCallback((en: string, zh: ChineseName | null) => localName(locale, en, zh), [locale]);
}
