"use client";

import { useRef, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { motion, useInView, type MotionValue } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHECK, type CheckStep } from "@/content/landing.en";
import { Eyebrow } from "../Eyebrow";
import { ReceiptChip } from "../receipts";
import { Settle } from "../Settle";
import { CHECK as T } from "../timings";
import { appear, useKeys, useOnce, useReduce } from "../use-clock";
import { Narrowing } from "./PathsA";

// 02 · Bring it together (/move#check), across the page on the night ground, career first. Our
// worked example's line, career first: Arjun's industry, the hot role there, a key skill he misses, and
// the master's that adds it (content/landing.en.ts CHECK.line, worked out with lib/careers). The list
// beside the panel is the line's four steps (Base UI's vertical tabs, arrow keys); the spotlight panel
// shows the picked step with its receipt, or "our count" where the step rests on our own count. The
// panel crossfades and rises 24px, 550ms on the UI curve (opacity only with reduced motion). It plays
// once, when half of the picture beside the heading is in view (timings.ts CHECK): six roads narrow to
// one, then the steps come in from 18px to the left, 0.3s apart. With reduced motion it is at its end at
// once; with JS off the picture is drawn and every step shown.

const ROWS = T.rows;
const END = ROWS.from + (CHECK.line.length - 1) * ROWS.step + ROWS.duration;

/** JS off: the picture's last frame. */
const NOSCRIPT = `<style>.move-page [data-narrow] path,.move-page [data-narrow] circle{opacity:1!important;stroke-dasharray:none!important;transform:none!important}.move-page [data-narrow] path[data-fades]{opacity:${T.fadeTo}!important}</style>`;

/** A hairline on the night ground, from its ink. */
const LINE = "border-[color-mix(in_oklab,var(--land-night-ink)_14%,transparent)]";
/** The same, held on the active and focused tab (Base UI's tab styles would recolour it). */
const LINE_HELD =
  "data-active:border-[color-mix(in_oklab,var(--land-night-ink)_14%,transparent)] dark:data-active:border-[color-mix(in_oklab,var(--land-night-ink)_14%,transparent)] dark:group-data-[variant=line]/tabs-list:data-active:border-[color-mix(in_oklab,var(--land-night-ink)_14%,transparent)] focus-visible:border-[color-mix(in_oklab,var(--land-night-ink)_14%,transparent)]";

type Clock = { clock: MotionValue<number> };

/** `stepClassName`: the step number's colour (amber on the English page). */
export function CheckSection({ stepClassName }: { stepClassName?: string }) {
  const t = useT();
  const reduce = useReduce();
  const picture = useRef<HTMLDivElement>(null);
  const started = useInView(picture, { once: true, amount: T.amount });
  const clock = useOnce(END, started, reduce);
  const [step, setStep] = useState(CHECK.line[0].label);

  return (
    <section id="check" aria-labelledby="check-title" className="on-dark scroll-mt-16 bg-(--land-night) py-20 text-(--land-night-ink) sm:py-28">
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT }} />
      <div className="home-wrap flex flex-col gap-12 sm:gap-14">
        {/* The heading, with the picture beside it from md and under it on phones. */}
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center md:gap-10">
          <Settle className="flex flex-col gap-3">
            <Eyebrow step={CHECK.step} tone="night" stepClassName={stepClassName} />
            <h2 id="check-title" className="m-0 min-w-0 font-heading text-[clamp(40px,5.6vw,88px)] [font-stretch:var(--display-stretch)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
              {t(CHECK.title)}
            </h2>
            <p className="m-0 mt-2 max-w-[30rem] font-heading text-[20px] [font-stretch:var(--display-stretch)] leading-snug font-bold text-balance text-(--hero-lavender) sm:text-[24px]">{t(CHECK.body)}</p>
          </Settle>
          <div ref={picture} data-narrow className="relative aspect-[5/3] w-full max-w-[260px] self-center md:max-w-[360px] md:justify-self-end">
            <Narrowing clock={clock} label={t(CHECK.figure)} />
          </div>
        </div>

        <Tabs orientation="vertical" value={step} onValueChange={(v) => setStep(v as string)} className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <div className={cn("grid min-w-0 overflow-hidden rounded-3xl border border-solid bg-[color-mix(in_oklab,var(--land-night-ink)_6%,transparent)]", LINE)}>
            {CHECK.line.map((s, i) => (
              <TabsContent
                key={s.label}
                value={s.label}
                keepMounted
                className={cn(
                  "[grid-area:1/1] min-w-0 p-6 outline-none sm:p-9",
                  "transition-[opacity,translate] duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-opacity",
                  "data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:translate-y-6",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid",
                )}
              >
                <Panel step={s} n={i + 1} />
              </TabsContent>
            ))}
          </div>

          <TabsList aria-label={t(CHECK.steps)} variant="line" className={cn("h-auto w-full items-stretch gap-0 rounded-none border-0 border-b border-solid bg-transparent p-0 group-data-vertical/tabs:h-auto", LINE)}>
            {CHECK.line.map((s, i) => (
              <Step key={s.label} clock={clock} index={i} step={s} />
            ))}
          </TabsList>
        </Tabs>
      </div>
    </section>
  );
}

/** One step in the spotlight: whose line, the step, its value, one line on it, and its receipt or "our count". */
function Panel({ step, n }: { step: CheckStep; n: number }) {
  const t = useT();
  const value = t(step.value);
  return (
    <div className="flex flex-col">
      <p className="m-0 text-[14px] text-(--land-night-muted)">{t(CHECK.who)}</p>
      <p className="m-0 mt-5 text-[14px] font-medium text-(--land-night-body)">
        <span className="font-semibold tabular-nums">{n}</span> · {t(step.label)}
      </p>
      <h3 className="m-0 mt-1.5 font-heading text-[clamp(26px,3vw,40px)] [font-stretch:var(--display-stretch)] leading-[1.15] font-bold tracking-[-0.01em] text-balance">{value}</h3>
      {/* The official wording, as published (English on every page). */}
      {step.quote && (
        <p lang="en" className="m-0 mt-4 max-w-[52ch] border-0 border-l-2 border-solid border-[color-mix(in_oklab,var(--hero-lavender)_40%,transparent)] pl-4 text-[15px] leading-[1.5] text-pretty text-(--land-night-muted)">
          {step.quote}
        </p>
      )}
      <p className="m-0 mt-4 max-w-[48ch] text-[16px] leading-[1.6] text-pretty text-(--land-night-body)">{t(step.detail)}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step.receipts.length > 0 && <ReceiptChip ids={step.receipts} title={value} tone="brand" />}
        {step.source && (
          <a
            href={step.source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-solid border-current/40 px-2.5 py-0.5 text-[13px] font-medium text-(--land-night-ink) no-underline outline-none hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid"
          >
            {step.source.label}
            <ExternalLinkIcon aria-hidden className="size-3.5" />
          </a>
        )}
        {step.ours && <span className="rounded-full border border-dashed border-current/40 px-2.5 py-0.5 text-[13px] font-medium text-(--land-night-muted)">{t(CHECK.ours)}</span>}
      </div>
    </div>
  );
}

/** One step in the list beside the panel: in from 18px to the left on the section's clock, `index` steps after the first. */
function Step({ clock, index, step }: Clock & { index: number; step: CheckStep }) {
  const t = useT();
  const start = ROWS.from + index * ROWS.step;
  const opacity = useKeys(clock, [start, start + ROWS.duration], [0, 1], appear);
  const x = useKeys(clock, [start, start + ROWS.duration], [ROWS.shift, 0], appear);
  return (
    <motion.div data-still style={{ opacity, x }} className="flex">
      <TabsTrigger
        value={step.label}
        className={cn(
          "h-auto w-full flex-none cursor-pointer flex-col items-start justify-start gap-1 rounded-none border-0 border-t border-solid px-0 py-5 text-left whitespace-normal",
          LINE,
          LINE_HELD,
          "text-(--land-night-muted) hover:text-(--land-night-ink) dark:text-(--land-night-muted) dark:hover:text-(--land-night-ink)",
          "data-active:bg-transparent data-active:text-(--land-night-ink) dark:data-active:bg-transparent dark:data-active:text-(--land-night-ink) group-data-[variant=line]/tabs-list:data-active:bg-transparent",
          "after:bg-(--accent) group-data-vertical/tabs:after:right-auto group-data-vertical/tabs:after:-left-4 group-data-vertical/tabs:after:inset-y-5 sm:group-data-vertical/tabs:after:-left-5",
          "transition-colors duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-none",
          "focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid",
        )}
      >
        <span className="block text-[13px] font-medium">
          <span className="tabular-nums">{index + 1}</span> · {t(step.label)}
        </span>
        <span className="block font-heading text-[18px] [font-stretch:var(--display-stretch)] leading-[1.3] font-bold sm:text-[20px]">{t(step.value)}</span>
      </TabsTrigger>
    </motion.div>
  );
}
