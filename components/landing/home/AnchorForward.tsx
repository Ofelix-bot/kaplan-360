"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/i18n/config";

// The old homepage's sections now live on /move. A link or bookmark to /#look, /#check or /#distance
// is sent on there (location.replace, so Back doesn't return to the empty anchor), in the same language.
// Effects run again when Activity shows the page, and on a hash change within it.

const MOVED: Record<string, string> = { "#look": "/move#look", "#check": "/move#check", "#distance": "/move#look" };

export function AnchorForward() {
  const locale = useLocale();
  useEffect(() => {
    const forward = () => {
      const to = MOVED[window.location.hash];
      if (to) window.location.replace(localizePath(locale, to));
    };
    forward();
    window.addEventListener("hashchange", forward);
    return () => window.removeEventListener("hashchange", forward);
  }, [locale]);
  return null;
}
