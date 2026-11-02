"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ChevronDownIcon, ListChecksIcon, MessageSquareTextIcon, UserRoundSearchIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useLocalize, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { CATCHES } from "@/lib/home/content";
import { receiptsOf } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import { openExample } from "@/lib/plan-storage";
import { PERSONAS, type Persona } from "@/lib/personas";
import { Describe } from "./describe";
import { Magnetic } from "./magnetic";
import { Quote, ReceiptChip, useSourceName } from "../receipts";
import { VerdictBadge } from "./rules";
import { SectionHead } from "./section-head";

// 06 Start: three example students, each with the catch the official pages hold for them. A card
// opens out in place (the others make room) to show the sentences behind the catch and to open the
// student's programmes or plan. Then the way in for the visitor: Start planning, or one sentence.

export function Start({ sentence, programmes, disciplines, schools }: { sentence: boolean; programmes: KaplanProgrammeOption[]; disciplines: Record<string, string>; schools: SchoolOption[] }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [describe, setDescribe] = useState(false);
  return (
    <section id="start" aria-labelledby="start-title" className="bg-background">
      <div className="home-wrap flex flex-col gap-10 py-16 lg:py-24">
        <SectionHead
          id="start-title"
          index="06"
          eyebrow={t("Get started")}
          title={t("Start from where you are.")}
          lede={t("Every student has a catch. Here are three, found on the official pages. Yours takes a sentence to find.")}
        />
        <LayoutGroup>
          <ul className="grid gap-4 md:grid-flow-row-dense md:grid-cols-3">
            {PERSONAS.map((p) => (
              <Student key={p.id} persona={p} />
            ))}
          </ul>
        </LayoutGroup>

        <motion.div layout={!reduce} id="describe" className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white sm:p-10">
          <span aria-hidden className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-amber/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex max-w-xl flex-col gap-2">
              <h3 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">{t("Find your catch before it finds you.")}</h3>
              <p className="text-white/75">{t("Answer three questions or write one sentence. Every answer you get comes with its receipt.")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/results" className="inline-flex h-12 items-center gap-2 rounded-full bg-amber px-6 font-semibold text-amber-text shadow-[0_10px_30px_-10px_rgb(255_181_71/0.7)] transition-transform active:scale-[0.97]">
                  {t("Start planning")}
                  <ArrowRightIcon aria-hidden className="size-4" />
                </Link>
              </Magnetic>
              {sentence ? (
                <Magnetic strength={0.2}>
                  <button
                    type="button"
                    aria-expanded={describe}
                    aria-controls="describe-panel"
                    onClick={() => setDescribe((v) => !v)}
                    className="inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-white ring-1 ring-white/30 transition-[background-color,transform] hover:bg-white/10 active:scale-[0.97]"
                  >
                    <MessageSquareTextIcon aria-hidden className="size-4" />
                    {t("Describe yourself")}
                    <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform duration-200", describe && "rotate-180")} />
                  </button>
                </Magnetic>
              ) : null}
            </div>
          </div>
          <AnimatePresence initial={false}>
            {sentence && describe && (
              <motion.div
                id="describe-panel"
                key="panel"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                className="relative overflow-hidden"
              >
                <div className="mt-6 rounded-2xl bg-card p-4 text-card-foreground sm:p-5">
                  <Describe programmes={programmes} disciplines={disciplines} schools={schools} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

/** One example student: who, what they want, their catch; opened, the sentences behind it and their programmes. */
function Student({ persona: p }: { persona: Persona }) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalize();
  const reduce = useReducedMotion();
  const source = useSourceName();
  const openId = useHome((s) => s.student);
  const setStudent = useHome((s) => s.setStudent);
  const open = openId === p.id;
  const c = CATCHES[p.id];
  const receipts = receiptsOf(c?.receipts ?? []);
  const go = (to: "/results" | "/plan") => {
    openExample(p.id, p.answers(new Date()));
    router.push(localize(to));
  };
  return (
    <motion.li
      layout={!reduce}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      // Opened, the card takes two thirds of the row and both rows; the other two stack beside it.
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10", open && "md:order-first md:col-span-2 md:row-span-2")}
    >
      <motion.div layout="position" className={cn("flex flex-col gap-4 p-5", open && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-8")}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-heading font-bold">
              {p.name[0]}
            </span>
            <div className="flex min-w-0 flex-col">
              <h3 className="font-heading text-base font-semibold">{p.name}</h3>
              <span className="text-xs text-muted-foreground text-pretty">{t(p.now)}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t(p.goal)}</p>
          {c && (
            <div className="flex flex-col gap-2">
              <VerdictBadge verdict={receipts.length ? "fails" : "check"}>{t("The catch")}</VerdictBadge>
              <p className="text-sm text-pretty">{t(c.catch)}</p>
            </div>
          )}
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="more"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.25, delay: reduce ? 0 : 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col gap-3"
            >
              {receipts.length ? (
                <>
                  <p className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{t("Behind the catch")}</p>
                  <ul className="flex flex-col gap-2">
                    {receipts.map((r) => (
                      <li key={r.id} className="rounded-xl border border-dashed p-3">
                        <p className="text-xs text-muted-foreground">
                          {source(r.source).label} · {t(r.context)}
                        </p>
                        {r.quote && (
                          <p className="mt-1 text-sm leading-relaxed font-medium">
                            <Quote text={r.quote} mark={r.mark} />
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  <UserRoundSearchIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
                  {t("No single page settles this one. Each programme words its entry rules differently, so a counsellor reads them with you.")}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => go("/results")} className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.97]">
                  {t("Their programmes")}
                  <ArrowRightIcon aria-hidden className="size-4" />
                </button>
                <button type="button" onClick={() => go("/plan")} className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-foreground/15 transition-[background-color,transform] hover:bg-muted active:scale-[0.97]">
                  <ListChecksIcon aria-hidden className="size-4" />
                  {t("Their plan")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <motion.div layout="position" className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t bg-muted/50 px-5 py-3">
        {receipts.length ? (
          <ReceiptChip ids={c.receipts} title={t("{name}’s catch", { name: p.name })} />
        ) : (
          <VerdictBadge verdict="check">
            <UserRoundSearchIcon aria-hidden className="size-3.5" />
            {t("Goes to a counsellor")}
          </VerdictBadge>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setStudent(open ? null : p.id)}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/8"
        >
          {open ? t("Show less") : t("{name}’s plan", { name: p.name })}
          <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </motion.div>
    </motion.li>
  );
}
