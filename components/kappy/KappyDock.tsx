"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import type { KappyEngine } from "./engine";
import { Kappy, KappyBubble } from "./Kappy";
import css from "./kappy.module.css";

// Kappy in the bottom-left corner of every page (mounted in app/[lang]/layout.tsx): the site's one floating button
// since the profile button went (2026-11-03). A click: it waves, asks its question and offers the way in; a second
// click, or 9 s, puts the bubble away. It reads no route (the layout must stay prerendered), so the link carries no
// `from`. On /adviser itself the page marks [data-kappy-stage] and kappy.module.css hides the dock: Kappy is on stage there.

const ADVISER_HREF = "/adviser";

export function KappyDock() {
  const t = useT();
  const kappy = useRef<KappyEngine | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), 9000);
    return () => window.clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (!open) kappy.current?.hush();
  }, [open]);

  return (
    <div className={css.dock}>
      <Kappy
        ref={kappy}
        bubble={bubble}
        poke={t("Ask me: master's first, or work first?")}
        label={open ? t("Close Kappy's message") : t("Kappy, the AI adviser: click for help")}
        onClick={() => {
          if (open) {
            kappy.current?.hush();
            setOpen(false);
          } else setOpen(true);
        }}
      />
      <KappyBubble ref={bubble} empty className={css.dockBubble}>
        {open && (
          <>
            <br />
            <Link href={ADVISER_HREF}>{t("Ask the AI adviser")} →</Link>
          </>
        )}
      </KappyBubble>
    </div>
  );
}
