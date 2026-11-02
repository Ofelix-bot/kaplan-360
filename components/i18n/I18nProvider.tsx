"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, INTL_LOCALE, localizePath, type Locale } from "@/lib/i18n/config";
import { makeT, type Messages, type T } from "@/lib/i18n/translate";

// Client Components get the page's language and its messages from the root layout. Only the
// current language's messages are sent to the browser.

const Ctx = createContext<{ locale: Locale; t: T }>({ locale: DEFAULT_LOCALE, t: makeT({}) });

export default function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(messages) }), [locale, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx).locale;
export const useT = () => useContext(Ctx).t;
/** For Intl formatters (dates, numbers). */
export const useIntlLocale = () => INTL_LOCALE[useContext(Ctx).locale];
/** Turns an internal path into the current language's path. */
export function useLocalize() {
  const locale = useContext(Ctx).locale;
  return (href: string) => localizePath(locale, href);
}
