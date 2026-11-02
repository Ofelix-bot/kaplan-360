"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon, FlagIcon, ListOrderedIcon, RadarIcon, ScrollTextIcon, SearchIcon, SlidersHorizontalIcon, SplitIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { toast } from "@/components/ui/toast";
import type { useHomeAnswers } from "@/lib/home/answers";
import { useHome } from "@/lib/home/store";
import { msg } from "@/lib/i18n/translate";
import { MonthPicker } from "./month-picker";
import { Segmented } from "./segmented";

// The page's own navigation, floating at the bottom once the hero has scrolled away: the six
// sections (the one being read is marked, and the mark slides as you scroll), search (⌘K), and
// "Your answers", which opens the bar out into a small toolbar to change the answers the sections
// follow, from anywhere on the page.

export const SECTIONS = [
  { id: "clock", label: msg("Your clock"), icon: ClockIcon },
  { id: "rules", label: msg("Hidden rules"), icon: ScrollTextIcon },
  { id: "fine-print", label: msg("Fine print"), icon: SplitIcon },
  { id: "moves", label: msg("Your moves"), icon: ListOrderedIcon },
  { id: "watch", label: msg("Rule watch"), icon: RadarIcon },
  { id: "start", label: msg("Get started"), icon: FlagIcon },
] as const;

/** The section being read: the last one whose top has passed 40% of the window. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const current = SECTIONS.find((s) => seen.get(s.id));
        setActive(current?.id ?? null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

/** Shown once the hero is out of view. */
function usePastHero() {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting), { threshold: 0.05 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return past;
}

export function FloatingNav({ answers, today }: { answers: ReturnType<typeof useHomeAnswers>; today: Date | null }) {
  const t = useT();
  const reduce = useReducedMotion();
  const active = useActiveSection();
  const past = usePastHero();
  const setPaletteOpen = useHome((s) => s.setPaletteOpen);
  const [tools, setTools] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // The toolbar closes with Escape or a click elsewhere, and gives focus back to its button.
  useEffect(() => {
    if (!tools) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTools(false);
        toggle.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-slot=popover-content]")) setTools(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [tools]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <AnimatePresence>
      {(past || tools) && (
        <motion.nav
          aria-label={t("Sections of this page")}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.12 }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 sm:bottom-6"
        >
          <motion.div
            ref={box}
            layout={!reduce}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
            style={{ borderRadius: 28 }}
            className="pointer-events-auto flex max-w-full flex-col overflow-hidden bg-foreground/92 text-background shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] ring-1 ring-white/10 backdrop-blur-md dark:bg-[#241e45]/95 dark:text-foreground"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {tools && (
                <motion.div
                  key="tools"
                  id="your-answers"
                  role="group"
                  aria-label={t("Your answers")}
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.1 } }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : 0.08 }}
                  className="grid w-[min(24rem,calc(100vw-1.5rem))] gap-4 p-4 pb-2 lg:w-auto lg:grid-cols-[auto_auto_minmax(11rem,1fr)] lg:items-end lg:gap-x-6"
                >
                  <div className="flex items-center justify-between lg:col-span-3">
                    <p className="text-sm font-semibold text-background dark:text-foreground">{t("Your answers")}</p>
                    <p className="text-xs text-background/60 dark:text-muted-foreground">{t("The sections follow them")}</p>
                  </div>
                  <ToolRow label={t("Where are you now?")}>
                    <Segmented
                      size="sm"
                      tone="brand"
                      label={t("Where are you now?")}
                      value={answers.ready ? answers.level : null}
                      options={[
                        { value: "diploma", label: t("Diploma student") },
                        { value: "degree", label: t("Degree student") },
                      ]}
                      onChange={(v) => answers.setLevel(v)}
                    />
                  </ToolRow>
                  <ToolRow label={t("How are you in Singapore?")}>
                    <Segmented
                      size="sm"
                      tone="brand"
                      label={t("How are you in Singapore?")}
                      value={answers.ready ? answers.residency : null}
                      options={[
                        { value: "student-pass", label: t("Student’s Pass") },
                        { value: "local", label: t("Singaporean or PR") },
                      ]}
                      onChange={(v) => {
                        answers.setResidency(v);
                        toast.add({ title: t("The page now follows your answer"), description: v === "local" ? t("Singaporean or PR") : t("Student’s Pass") });
                      }}
                    />
                  </ToolRow>
                  <ToolRow id="toolbar-course-end" label={t("My course ends in")}>{today && <MonthPicker today={today} value={answers.courseEnd} onPick={answers.setCourseEnd} labelledBy="toolbar-course-end" tone="brand" />}</ToolRow>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div layout="position" className="flex items-center gap-0.5 p-1.5">
              <ul className="flex items-center gap-0.5">
                {SECTIONS.map((s) => {
                  const on = active === s.id;
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          go(s.id);
                        }}
                        aria-current={on ? "location" : undefined}
                        aria-label={t(s.label)}
                        className={cn(
                          "relative flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber",
                          on ? "text-brand" : "text-background/70 hover:text-background dark:text-muted-foreground dark:hover:text-foreground",
                        )}
                      >
                        {on && <motion.span layoutId="floating-nav-pill" aria-hidden className="absolute inset-0 rounded-full bg-amber" transition={{ type: "spring", duration: 0.35, bounce: 0.15 }} />}
                        <s.icon aria-hidden className="relative size-4" />
                        <span className="relative hidden xl:inline">{t(s.label)}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <span aria-hidden className="mx-1 h-6 w-px bg-background/20 dark:bg-white/15" />
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label={t("Search this page")}
                aria-keyshortcuts="Control+K Meta+K"
                className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-background/70 transition-colors outline-none hover:text-background focus-visible:ring-2 focus-visible:ring-amber dark:text-muted-foreground dark:hover:text-foreground"
              >
                <SearchIcon aria-hidden className="size-4" />
                <kbd className="hidden rounded-md bg-background/15 px-1.5 py-0.5 font-sans text-[0.7rem] font-medium lg:inline dark:bg-white/10">⌘K</kbd>
              </button>
              <button
                ref={toggle}
                type="button"
                aria-expanded={tools}
                aria-controls="your-answers"
                onClick={() => setTools((v) => !v)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber",
                  tools ? "bg-background/15 text-background dark:bg-white/10 dark:text-foreground" : "text-background/70 hover:text-background dark:text-muted-foreground dark:hover:text-foreground",
                )}
              >
                {tools ? <XIcon aria-hidden className="size-4" /> : <SlidersHorizontalIcon aria-hidden className="size-4" />}
                <span className="hidden sm:inline">{t("Your answers")}</span>
              </button>
            </motion.div>
          </motion.div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

function ToolRow({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-xs text-background/60 dark:text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
