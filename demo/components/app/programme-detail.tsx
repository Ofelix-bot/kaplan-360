"use client"

import { ExternalLinkIcon, MousePointerClickIcon, TriangleAlertIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { GpaBand, MixBar } from "@/components/app/admitted-figures"
import { ShortlistToggle } from "@/components/app/shortlist-toggle"
import { SourcesPopover } from "@/components/app/sources-popover"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { useProgramme, useUniversity } from "@/lib/data"
import { duration, gpa as formatGpa, intakeMonths, percent, plural, score, sgd } from "@/lib/format"
import { COUNTRY_LABEL, DISCIPLINE_LABEL, FLAG_TEXT } from "@/lib/labels"
import { transitions } from "@/lib/motion"
import { useAppStore } from "@/lib/store"
import type { Programme, TestStatus } from "@/lib/types"

const TEST_WORDS: Record<TestStatus, string> = {
  required: "required",
  optional: "optional",
  "not-required": "not required",
  mentioned: "mentioned",
}

function englishText(p: Programme) {
  const scores = [p.ielts && `IELTS ${score(p.ielts)}`, p.toefl && `TOEFL iBT ${p.toefl}`]
    .filter(Boolean)
    .join(" · ")
  if (scores && p.waiver) return `${scores}. Not needed with an English-taught degree from Singapore.`
  if (p.waiver) return "Not needed with an English-taught degree from Singapore."
  return scores || "Not stated on the programme page"
}

function testsText(p: Programme) {
  const parts = [p.gre && `GRE ${TEST_WORDS[p.gre]}`, p.gmat && `GMAT ${TEST_WORDS[p.gmat]}`]
  return parts.filter(Boolean).join(" · ") || "Not mentioned"
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-heading text-base font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Admitted({ programme }: { programme: Programme }) {
  const mine = useAppStore((s) => s.gpa)
  const c = programme.cases
  const asking = c.status.fresh + c.status.graduated + c.status.working + c.status.other
  const variance = c.flags.filter((f) => f !== "few")
  const experience = c.experience
    ? (
        [
          ["Internship", c.experience.internship],
          ["Competition", c.experience.competition],
          ["Research", c.experience.research],
          ["Work", c.experience.work],
          ["Project", c.experience.project],
        ] as const
      ).filter(([, n]) => n > 0)
    : []

  return (
    <section aria-labelledby="admitted-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h3 id="admitted-heading" className="font-heading text-sm font-semibold">
          Who was admitted
        </h3>
        <p className="text-xs text-muted-foreground">
          {plural(c.n, "admit")} reported
          {c.years && `, ${c.years[0]}–${c.years[1]}`}
          {c.rejected > 0 && ` · ${plural(c.rejected, "rejection")}`}
        </p>
      </div>

      {variance.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>High variance</AlertTitle>
          <AlertDescription>{variance.map((f) => FLAG_TEXT[f]).join(" ")}</AlertDescription>
        </Alert>
      )}

      {c.gpa && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium">GPA on the 4-point scale</span>
            <span className="text-muted-foreground tabular-nums">
              middle 80% {formatGpa(c.gpa.p10)}–{formatGpa(c.gpa.p90)} · {plural(c.gpa.n, "GPA")}
            </span>
          </div>
          <GpaBand spread={c.gpa} mine={mine} size="lg" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {c.ielts && <Stat value={score(c.ielts.median)} label={`IELTS median · ${c.ielts.n}`} />}
        {c.toefl && <Stat value={c.toefl} label="TOEFL median" />}
        {c.gre && <Stat value={c.gre} label="GRE median" />}
        {c.gmat && <Stat value={c.gmat} label="GMAT median" />}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium">First degree</span>
        <MixBar mix={c.mix} />
      </div>

      {asking > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${percent(c.status.fresh, asking)}%`} label="in final year" />
          <Stat value={`${percent(c.status.graduated, asking)}%`} label="graduated" />
          <Stat value={`${percent(c.status.working, asking)}%`} label="working" />
        </div>
      )}

      {c.experience && experience.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">
            Listed on the {plural(c.experience.sampled, "newest case page")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {experience.map(([label, n]) => (
              <Badge key={label} variant="outline" className="tabular-nums">
                {label} {n}/{c.experience!.sampled}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{c.flags.includes("few") ? FLAG_TEXT.few : "Aggregated; no individual cases shown."}</span>
        <SourcesPopover sources={c.sources} />
      </div>
    </section>
  )
}

function DetailEmpty() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MousePointerClickIcon />
        </EmptyMedia>
        <EmptyTitle>Pick a programme</EmptyTitle>
        <EmptyDescription>
          Its requirements and the profile of admitted students show here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function ProgrammeDetail({ id }: { id: string | null }) {
  const programme = useProgramme(id)
  const university = useUniversity(programme)
  if (!programme || !university) return <DetailEmpty />

  const fee = programme.feeSgd !== null ? `≈ ${sgd(programme.feeSgd)} a year` : "Not stated"
  const intakes = intakeMonths(programme.intake)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.article
        key={programme.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: transitions.exit }}
        transition={transitions.enter}
        className="flex flex-col gap-5 p-4"
      >
        <header className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {university.name} · {COUNTRY_LABEL[university.country] ?? university.country}
            {university.qs !== null && ` · QS ${university.qs}`}
          </p>
          <h2 className="font-heading text-lg leading-snug font-semibold text-balance">
            {programme.name}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{DISCIPLINE_LABEL[programme.discipline]}</Badge>
            {university.partner && <Badge>Kaplan partner</Badge>}
            {programme.any && <Badge variant="outline">Any first degree</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ShortlistToggle id={programme.id} name={programme.name} labelled />
            <a
              href={programme.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              Official page
              <ExternalLinkIcon className="size-3.5" />
            </a>
            <span className="text-xs text-muted-foreground">checked {programme.checked}</span>
          </div>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <Fact label="Tuition">{fee}</Fact>
          {programme.months !== null && <Fact label="Length">{duration(programme.months)}</Fact>}
          {intakes && <Fact label="Starts">{intakes}</Fact>}
          <Fact label="English">{englishText(programme)}</Fact>
          <Fact label="GRE / GMAT">{testsText(programme)}</Fact>
          <Fact label="Degree">{programme.minBasis ?? "Not stated"}</Fact>
          <Fact label="Work">
            {programme.work ? `${plural(programme.work, "year")} asked for` : "Not asked for"}
          </Fact>
          {programme.mode === "part-time" && (
            <Fact label="Mode">Part-time only, usually closed to Student’s Pass holders</Fact>
          )}
        </dl>

        <Separator />
        <Admitted programme={programme} />
      </motion.article>
    </AnimatePresence>
  )
}
