"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LOCALE_NAME, LOCALE_SHORT, LOCALES, localizePath, splitLocale, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "./I18nProvider";

// Top-right language menu. The target URL is worked out from the address bar when a language is
// picked (reading the route while rendering would stop request-time routes prerendering a shell).
// Switching loads the page again: each language has its own root layout and <html lang>.

export default function LanguageSwitcher({ onPick }: { onPick?: () => void }) {
  const locale = useLocale();
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (to: Locale) => {
    setOpen(false);
    onPick?.();
    if (to === locale) return;
    const { path } = splitLocale(window.location.pathname);
    window.location.assign(localizePath(to, path) + window.location.search + window.location.hash);
  };

  return (
    <div className="lang" ref={root}>
      <button type="button" className="lang-toggle" aria-expanded={open} aria-controls={`${id}-menu`} aria-label={t("Language: {name}", { name: LOCALE_NAME[locale] })} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9" />
        </svg>
        <span className="lang-short">{LOCALE_SHORT[locale]}</span>
      </button>
      <ul id={`${id}-menu`} className={`lang-menu${open ? " is-open" : ""}`} hidden={!open}>
        {LOCALES.map((l) => (
          <li key={l}>
            <button type="button" lang={l === "en" ? "en" : l === "zh-hans" ? "zh-Hans" : "zh-Hant"} aria-current={l === locale ? "true" : undefined} onClick={() => go(l)}>
              {LOCALE_NAME[l]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
