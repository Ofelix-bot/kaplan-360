"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MicIcon, MicOffIcon, SquareIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { cn } from "cn";
import type { KappyEngine } from "./engine";
import css from "./kappy.module.css";

// Talking to Kappy: the browser's own speech recognition (Web Speech API, as components/finder/voice-input.tsx), free
// and with no key. While it listens, Kappy turns to listen and nods at every word it hears; the words go wherever the
// page puts them (onText, live, after what was already there) and onDone gets the whole of it. The language follows
// the page; 60 s at most. Hidden where the browser has none (Firefox); greyed once the microphone is refused.

const MAX_SECONDS = 60;

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

const recognitionClass = (): RecognitionClass | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const noSubscribe = () => () => {};

type Props = {
  /** The Kappys that react: they listen and nod while the browser hears. */
  kappys: () => (KappyEngine | null | undefined)[];
  /** What the box held before speaking; what is heard goes after it. */
  value?: string;
  onText?: (text: string) => void;
  onDone?: (text: string) => void;
  /** Told when listening starts and stops. */
  onListening?: (on: boolean) => void;
  maxLength?: number;
  className?: string;
};

export function KappyMic({ kappys, value = "", onText, onDone, onListening, maxLength = 800, className }: Props) {
  const t = useT();
  const locale = useLocale();
  const supported = useSyncExternalStore(noSubscribe, () => !!recognitionClass(), () => false);
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const latest = useRef({ kappys, onText, onDone, onListening });
  useEffect(() => {
    latest.current = { kappys, onText, onDone, onListening };
  });

  useEffect(() => () => rec.current?.stop(), []);
  useEffect(() => {
    if (!listening) return;
    const id = window.setTimeout(() => rec.current?.stop(), MAX_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, [listening]);

  if (!supported) return null;

  const each = (fn: (k: KappyEngine) => void) => {
    for (const k of latest.current.kappys()) if (k) fn(k);
  };

  const start = () => {
    const Rec = recognitionClass();
    if (!Rec) return;
    const r = new Rec();
    r.lang = locale === "en" ? "en-SG" : locale === "zh-hant" ? "zh-HK" : "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    const before = value.trim() ? value.trimEnd() + (locale === "en" ? " " : "") : "";
    let heard = "";
    r.onresult = (e) => {
      heard = Array.from(e.results, (x) => x[0].transcript).join("");
      latest.current.onText?.((before + heard).slice(0, maxLength));
      each((k) => k.hear());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setDenied(true);
    };
    r.onend = () => {
      setListening(false);
      latest.current.onListening?.(false);
      rec.current = null;
      each((k) => k.set("idle"));
      if (heard.trim()) latest.current.onDone?.((before + heard).slice(0, maxLength));
    };
    rec.current = r;
    setListening(true);
    latest.current.onListening?.(true);
    each((k) => {
      k.set("listen");
      k.say(t("I'm listening…"));
    });
    r.start();
  };

  const label = denied ? t("Microphone access was refused") : listening ? t("Stop speaking") : t("Speak instead of typing");
  return (
    <button
      type="button"
      className={cn(css.mic, className)}
      data-on={listening ? "" : undefined}
      disabled={denied}
      aria-pressed={listening}
      aria-label={label}
      title={label}
      onClick={() => (listening ? rec.current?.stop() : start())}
    >
      {denied ? <MicOffIcon aria-hidden /> : listening ? <SquareIcon aria-hidden /> : <MicIcon aria-hidden />}
      <span>{listening ? t("Stop speaking") : t("Talk to Kappy")}</span>
    </button>
  );
}
