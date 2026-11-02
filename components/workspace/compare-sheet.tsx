"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { Columns3Icon, ExternalLinkIcon } from "lucide-react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { checks } from "@/components/results/compare";
import { campusLabel, type Row } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { rangeBasis, usualText } from "@/components/results/words";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { monthName } from "@/lib/i18n/format";
import { aside } from "@/lib/i18n/translate";
import { useWorkspace } from "@/lib/workspace/store";
import { useModel } from "./model";
import { money } from "./programme-detail";
import { CheckPills } from "./programme-parts";
import { SELECTED } from "./skin";

// Side-by-side comparison of up to three shortlisted programmes: the same rows for each, so the
// differences line up. Every value is as published, with the student's answers against them.

function CompareTable({ items }: { items: Row[] }) {
  const t = useT();
  const locale = useIntlLocale();
  const local = useLocalName();
  const { answers, university, awardedIn } = useModel();
  const rows: { label: string; value: (x: Row) => string }[] = [
    { label: "University", value: (x) => [`${local(x.u.name, x.u.zh).name} · ${t(x.u.country)}`, campusLabel(x.p, t)].filter(Boolean).join(" · ") },
    { label: "QS 2027", value: (x) => x.u.qs ?? t("Not ranked") },
    { label: "Admitted range", value: (x) => `${usualText(t, x.p.range.usual)} · ${rangeBasis(t, x.p.range)}` },
    { label: "Fee (international)", value: (x) => (x.p.fee ? `${money(x.p.fee.amount, x.p.fee.currency)}${x.p.fee.basis ? ` ${x.p.fee.basis}` : ""}` : t("Not stated")) },
    { label: "About S$ a year", value: (x) => (x.p.feeSgd !== null ? `S$${x.p.feeSgd.toLocaleString("en-SG")}` : t("Can’t compare")) },
    { label: "Length", value: (x) => (x.p.months ? t("{n} months", { n: x.p.months }) : t("Not stated")) },
    {
      label: "Starts",
      value: (x) =>
        x.p.intake
          ? Array.from({ length: 12 }, (_, i) => i)
              .filter((i) => x.p.intake & (1 << i))
              .map((i) => monthName(locale, i))
              .join(", ")
          : (x.p.intakeText ?? t("Not stated")),
    },
    { label: "IELTS", value: (x) => (x.p.ielts ? `${x.p.ielts}${x.p.englishUniversityWide ? aside(t("(university-wide)")) : ""}` : t("Not stated")) },
    { label: "TOEFL iBT", value: (x) => (x.p.toefl ? String(x.p.toefl) : t("Not stated")) },
    { label: "GRE / GMAT", value: (x) => [x.p.gre && `GRE ${t(x.p.gre.status.replace("-", " "))}`, x.p.gmat && `GMAT ${t(x.p.gmat.status.replace("-", " "))}`].filter(Boolean).join(" · ") || t("Not mentioned") },
  ];

  return (
    <Table className="min-w-[36rem] table-fixed text-sm sm:min-w-0">
      <TableHeader>
        <TableRow className="bg-(--rs-raised) hover:bg-(--rs-raised)">
          <TableHead className="w-32">
            <span className="sr-only">{t("Detail")}</span>
          </TableHead>
          {items.map((x) => {
            const name = local(x.p.name, x.p.zh);
            return (
              <TableHead key={x.p.id} className="h-auto py-2 align-top whitespace-normal">
                <span className="block leading-snug font-medium text-foreground">{name.name}</span>
                {name.en && <span className="block text-xs font-normal text-muted-foreground">{x.p.name}</span>}
                {x.u.partner && <Badge className="mt-1">{t("Kaplan partner")}</Badge>}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableHead scope="row" className="align-top text-xs whitespace-normal text-muted-foreground">
              {t(r.label)}
            </TableHead>
            {items.map((x) => (
              <TableCell key={x.p.id} className="align-top whitespace-normal">
                {r.value(x)}
              </TableCell>
            ))}
          </TableRow>
        ))}
        <TableRow>
          <TableHead scope="row" className="align-top text-xs whitespace-normal text-muted-foreground">
            {t("Your answers")}
          </TableHead>
          {items.map((x) => (
            <TableCell key={x.p.id} className="align-top whitespace-normal">
              <CheckPills checks={checks(x.p, answers, university, t, awardedIn)} />
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableHead scope="row" className="align-top text-xs whitespace-normal text-muted-foreground">
            {t("Official page")}
          </TableHead>
          {items.map((x) => (
            <TableCell key={x.p.id} className="align-top">
              <a href={x.p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                {t("Open")}
                <span className="sr-only">: {x.p.name}</span>
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function CompareSheet() {
  const t = useT();
  const local = useLocalName();
  const { results } = useModel();
  const items = results.starred;
  const [picked, setPicked] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  // Arriving with ?compare= (results-app.tsx): once those programmes are on the shortlist, the sheet opens on them.
  const request = useWorkspace((s) => s.compare);
  const [handled, setHandled] = useState<string[] | null>(null);
  if (request && request !== handled && request.some((id) => items.some((x) => x.p.id === id))) {
    setHandled(request);
    setPicked(request.filter((id) => items.some((x) => x.p.id === id)));
    setOpen(true);
  }
  useEffect(() => {
    if (handled) useWorkspace.getState().setCompare(null);
  }, [handled]);
  // The first three until the student picks.
  const chosen = (picked ?? items.slice(0, 3).map((x) => x.p.id)).filter((id) => items.some((x) => x.p.id === id));
  const shown = items.filter((x) => chosen.includes(x.p.id));
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : chosen.length < 3 ? [...chosen, id] : chosen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" disabled={items.length < 2} />}>
        <Columns3Icon />
        {t("Compare")}
      </SheetTrigger>
      <SheetContent side="right" overlayClassName="bg-black/40 dark:bg-black/70" className="gap-0 border-(--rs-line-soft) p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t("Compare your shortlist")}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {items.length > 3 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Choose up to three")}>
              {items.map((x) => (
                <Toggle key={x.p.id} variant="outline" size="sm" pressed={chosen.includes(x.p.id)} onPressedChange={() => toggle(x.p.id)} className={cn("max-w-64 rounded-full", SELECTED)}>
                  <span className="truncate">{local(x.p.name, x.p.zh).name}</span>
                </Toggle>
              ))}
            </div>
          )}
          {shown.length > 0 && <CompareTable items={shown} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
