"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MicIcon, MicOffIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Speaking instead of typing, for "Fill it in for me" (sentence-fill.tsx): the browser's own speech
// recognition (Web Speech API), free and with no key. The words go into the box as they are heard, and
// the student still presses the fill button. Hidden where the browser has none (Firefox); greyed when the
// microphone is refused. Language follows the page, with a toggle for the other one; 60 s at most.

const MAX_SECONDS = 60;

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

const recognitionClass = (): RecognitionClass | null =>
  typeof window === "undefined" ? null : ((window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionClass }).webkitSpeechRecognition ?? null);

const noSubscribe = () => () => {};

export function VoiceInput({ value, onChange, maxLength, onUsed }: { value: string; onChange: (text: string) => void; maxLength: number; onUsed: () => void }) {
  const t = useT();
  const locale = useLocale();
  // Known only in the browser: false on the server, so server and client HTML agree.
  const supported = useSyncExternalStore(
    noSubscribe,
    () => !!recognitionClass(),
    () => false,
  );
  const [lang, setLang] = useState<"zh" | "en">(locale === "en" ? "en" : "zh");
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.stop(), []);
  useEffect(() => {
    if (!listening) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) rec.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [listening]);

  if (!supported) return null;

  const start = () => {
    const Rec = recognitionClass();
    if (!Rec) return;
    const r = new Rec();
    r.lang = lang === "en" ? "en-SG" : locale === "zh-hant" ? "zh-TW" : "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    // What was in the box before speaking stays; what is heard goes after it.
    const before = value.trim() ? value.trimEnd() + (lang === "en" ? " " : "") : "";
    r.onresult = (e) => {
      const heard = Array.from(e.results, (x) => x[0].transcript).join("");
      onChange((before + heard).slice(0, maxLength));
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setDenied(true);
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
    };
    rec.current = r;
    setSeconds(0);
    setListening(true);
    onUsed();
    r.start();
  };

  const label = denied ? t("Microphone access was refused") : listening ? t("Stop speaking") : t("Speak instead of typing");
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={label}
              aria-pressed={listening}
              aria-disabled={denied}
              onClick={() => (denied ? undefined : listening ? rec.current?.stop() : start())}
              className={cn("size-10 rounded-xl", listening && "border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white", denied && "opacity-50")}
            />
          }
        >
          {denied ? <MicOffIcon aria-hidden /> : listening ? <SquareIcon aria-hidden className="fill-current" /> : <MicIcon aria-hidden />}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      {listening ? (
        <span className="w-12 text-sm tabular-nums text-destructive" aria-live="off">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={lang === "en" ? t("Speaking English; switch to Chinese") : t("Speaking Chinese; switch to English")}
          onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
          className="h-10 w-12 rounded-xl px-0 text-xs font-semibold text-muted-foreground"
        >
          {lang === "en" ? "EN" : "中"}
        </Button>
      )}
    </div>
  );
}
