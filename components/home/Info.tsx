"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * An "i" button that opens the chart's sources, definitions and caveats in a popover: everything
 * that used to sit under the chart as text, one click away. Native popover, so no script is needed.
 */
export default function Info({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const t = useT();
  return (
    <>
      <button type="button" className="info-button" popoverTarget={id} aria-label={t("Sources and definitions: {title}", { title })}>
        <span aria-hidden="true">i</span>
      </button>
      <div id={id} popover="auto" className="info-pop" role="dialog" aria-labelledby={`${id}-title`}>
        <div className="info-pop-head">
          <p id={`${id}-title`}>{title}</p>
          <button type="button" className="info-close" popoverTarget={id} popoverTargetAction="hide">
            {t("Close")}
          </button>
        </div>
        <div className="info-pop-body">{children}</div>
      </div>
    </>
  );
}
