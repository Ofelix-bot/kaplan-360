// The site's languages. English is the default and keeps its URLs (/results); Chinese pages live
// under /zh-hans and /zh-hant. Rewrites in next.config.ts send unprefixed paths to the English route (app/[lang]).

export const LOCALES = ["en", "zh-hans", "zh-hant"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: string | null | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/** BCP 47 tags for <html lang> and Intl formatting. */
export const HTML_LANG: Record<Locale, string> = { en: "en", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant" };
export const INTL_LOCALE: Record<Locale, string> = { en: "en-SG", "zh-hans": "zh-Hans-SG", "zh-hant": "zh-Hant-HK" };

/** Each language named in itself, for the switcher. */
export const LOCALE_NAME: Record<Locale, string> = { en: "English", "zh-hans": "简体中文", "zh-hant": "繁體中文" };
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", "zh-hans": "简", "zh-hant": "繁" };

/** An internal path in the given language: "/results" → "/zh-hans/results"; other hrefs pass through. */
export function localizePath(locale: Locale, href: string): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith("/") || href.startsWith("//")) return href;
  if (href === "/") return `/${locale}`;
  // "/#outcomes" and "/?x" belong to the home page.
  if (href[1] === "#" || href[1] === "?") return `/${locale}${href.slice(1)}`;
  return `/${locale}${href}`;
}

/** The language of a URL path and the path without its language prefix. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const first = pathname.split("/")[1];
  if (isLocale(first) && first !== DEFAULT_LOCALE) return { locale: first, path: pathname.slice(first.length + 1) || "/" };
  return { locale: DEFAULT_LOCALE, path: pathname };
}
