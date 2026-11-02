import { lang } from "next/root-params";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { MESSAGES } from "./messages";
import { makeT, type T } from "./translate";

// Server Components read the language from the root segment (app/[lang]) without prop drilling.

export async function getLocale(): Promise<Locale> {
  const l = await lang();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}

export async function getT(): Promise<T> {
  return makeT(MESSAGES[await getLocale()]);
}

/** A page's generateMetadata with a translated title and description. */
export function pageMetadata(title: string, description: string) {
  return async () => {
    const t = await getT();
    return { title: `${t(title)} · Kaplan 360++`, description: t(description) };
  };
}
