"use client";

import messages from "@/lib/i18n/messages/zh-hant.json";
import I18nProvider from "./I18nProvider";

// The Traditional Chinese dictionary as its own client module: the browser loads it once as a script (cached
// across pages) instead of every zh-hans page carrying it in its HTML and RSC data (about 1.3 MB a page, which
// made the deploy's page-cache upload too large). Only zh-hant pages reference this module.
export default function ZhHantProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="zh-hant" messages={messages}>
      {children}
    </I18nProvider>
  );
}
