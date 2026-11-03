"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalize, useT } from "@/components/i18n/I18nProvider";
import { useOpenAdviser } from "@/components/agent/AdviserDock";
import type { KappyEngine } from "./engine";
import { Kappy, KappyBubble } from "./Kappy";
import { KappyMic } from "./KappyMic";
import css from "./kappy.module.css";

// Kappy in the bottom-left corner of every page (mounted in app/[lang]/layout.tsx): the site's one floating button
// since the profile button went (2026-11-03). A click: it waves, asks its question and offers the way in, which opens
// the adviser the way the header's button does (the side panel on a wide screen, else /adviser); a second click, or
// 9 s, puts the bubble away. It hides on /adviser, which shows its own Kappy. Its microphone (KappyMic.tsx) takes a spoken
// question and opens /adviser?q= with it in the box; the bubble stays open while it listens.

export function KappyDock() {
  const t = useT();
  const kappy = useRef<KappyEngine | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [talking, setTalking] = useState(false);
  const [heard, setHeard] = useState("");
  const adviser = useOpenAdviser();
  const router = useRouter();
  const localize = useLocalize();

  useEffect(() => {
    if (!open || talking) return;
    const id = window.setTimeout(() => setOpen(false), 9000);
    return () => window.clearTimeout(id);
  }, [open, talking]);
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
            <br />
            <KappyMic
              kappys={() => [kappy.current]}
              onText={setHeard}
              onListening={setTalking}
              onDone={(q) => {
                setOpen(false);
                setHeard("");
                router.push(localize(`/adviser?q=${encodeURIComponent(q)}`));
              }}
            />
            {heard && <span className={css.heard}>“{heard}”</span>}
          </>
        )}
      </KappyBubble>
    </div>
  );
}
