"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { useMediaQuery } from "@/lib/use-media-query";

// One switch for every loop on the site (WCAG 2.2.2): the two particle canvases, the #why chats, the
// bento tiles and the receipts ticker. The visitor's choice is kept in localStorage (wrapped: it can
// throw in a private window or with blocked site data, and then it lives in memory for the visit).
// `usePaused()` is also true when the system asks for reduced motion. Both read false in the static
// HTML and during hydration (useSyncExternalStore's server snapshot), so the markup matches.
// The provider mirrors the state on <html data-paused> for CSS loops.

const KEY = "kaplan360:pause";
const EVENT = "kaplan360:pause-change";

/** Used when localStorage throws. */
let memory: boolean | null = null;

function readPaused() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === null ? (memory ?? false) : v === "1";
  } catch {
    return memory ?? false;
  }
}

function writePaused(value: boolean) {
  memory = value;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Kept in memory for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether the visitor pressed "Pause animations" (not counting the system setting). */
function useUserPaused() {
  return useSyncExternalStore(subscribe, readPaused, () => false);
}

/** True when the visitor paused animations or the system asks for reduced motion; false on the server and at hydration. */
export function usePaused(): boolean {
  const user = useUserPaused();
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  return user || reduce;
}

/** Mounted once in the root layout: keeps <html data-paused> in step for CSS-driven loops. */
export function PauseProvider({ children }: { children: React.ReactNode }) {
  const paused = usePaused();
  useEffect(() => {
    const root = document.documentElement;
    if (paused) root.dataset.paused = "true";
    else delete root.dataset.paused;
  }, [paused]);
  return <>{children}</>;
}

/** The site's one pause switch. Pressed while animations are paused (by the visitor or the system). */
export function PauseToggle({ className }: { className?: string }) {
  const t = useT();
  const user = useUserPaused();
  const paused = usePaused();
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => writePaused(!user)}
      className={cn(
        "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-solid border-current/25 bg-transparent px-4 text-[13px] leading-none font-semibold whitespace-nowrap text-inherit transition-colors duration-200 [font-family:inherit] hover:border-current/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) motion-reduce:transition-none",
        className,
      )}
    >
      {paused ? <PlayIcon aria-hidden className="size-3.5 shrink-0" /> : <PauseIcon aria-hidden className="size-3.5 shrink-0" />}
      <span className="text-[13px] font-semibold">{paused ? t("Play animations") : t("Pause animations")}</span>
    </button>
  );
}
