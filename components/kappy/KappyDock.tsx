"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { useOpenAdviser } from "@/components/agent/AdviserDock";
import type { KappyEngine } from "./engine";
import { Kappy, KappyBubble } from "./Kappy";
import css from "./kappy.module.css";

// Kappy in the bottom-left corner of every page (mounted in app/[lang]/layout.tsx), clear of the profile button on the
// right edge. A click: it waves, asks its question and offers the way in, which opens the adviser the way the header's
// button does (the side panel on a wide screen, else /adviser); a second click, or 9 s, puts the bubble away. It hides
// on /adviser, which shows its own Kappy.

export function KappyDock() {
  const t = useT();
  const kappy = useRef<KappyEngine | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const adviser = useOpenAdviser();

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
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                adviser.toggle();
              }}
            >
              {t("Open the AI adviser")} →
            </button>
          </>
        )}
      </KappyBubble>
    </div>
  );
}
