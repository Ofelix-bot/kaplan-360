"use client";

import { cn } from "cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RoadEntry } from "@/lib/plan-road";
import type { PlanItem, PlanRule } from "@/lib/plan-timeline";
import { AskPrompt } from "./AboutYouFields";
import { Awards } from "./Awards";
import { Chevron, Flag, FOCUS, ItemLink, OutLink, RuleQuote, useItemWhen, When } from "./parts";

// A row of the road (in Now, or inside a stop): its headline, the lines always shown under it and its
// date line, closed; a tap opens what it holds in place. EntryBody is that content, shared with the
// stops (RoadStop in Road.tsx): the details said once, each programme with its own official link, the
// official quotes one tap further, smaller rows and the scholarships.

/** A detail less what the row already says ("University of Portsmouth · Online." under "University of Portsmouth" is "Online."); null when nothing is left. */
const unsaid = (s: string | null | undefined, said: string[]): string | null => {
  let x = (s ?? "").trim();
  for (const y of said) if (y && x.startsWith(`${y} · `)) x = x.slice(y.length + 3);
  const bare = x.replace(/\.$/, "");
  return !bare || said.some((y) => y.trim().replace(/\.$/, "") === bare) ? null : x;
};

/** Whether a row has anything to open. */
const opens = (e: RoadEntry) =>
  e.rows.length > 0 || e.awards.length > 0 || !!e.tip || !!e.shared || e.items.some((i) => i.url || i.links?.length || i.rules?.length || unsaid(i.detail, [e.title, ...e.lines]));

/** The lines shown under a headline without a tap: an event's university, a late window's two lines. */
export function EntryLines({ entry }: { entry: RoadEntry }) {
  if (!entry.lines.length) return null;
  return (
    <span className="flex flex-col gap-0.5">
      {entry.lines.map((l, i) =>
        entry.late && i === 0 ? (
          <Flag key={i} text={l} />
        ) : (
          <span key={i} className="text-[13px] leading-5 text-muted-foreground">
            {l}
          </span>
        ),
      )}
    </span>
  );
}

/** Missing answers, asked here (outside the row's button, as they hold their own controls). */
export function EntryAsks({ entry }: { entry: RoadEntry }) {
  if (!entry.asks.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {entry.asks.map((a) => (
        <AskPrompt key={a} ask={a} />
      ))}
    </div>
  );
}

export function StopRow({ entry }: { entry: RoadEntry }) {
  const head = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span lang={entry.lang} className="text-[15px] leading-snug font-medium text-pretty text-foreground">
        {entry.title}
      </span>
      <EntryLines entry={entry} />
      <When when={entry.when} basis={entry.basis} />
      {entry.flag && <Flag text={entry.flag.text} basis={entry.flag.basis} />}
    </span>
  );
  if (!opens(entry))
    return (
      <div className="py-3">
        {head}
        <EntryAsks entry={entry} />
      </div>
    );
  return (
    <Collapsible className="py-3">
      <CollapsibleTrigger className={cn("group/row flex w-full items-start gap-3 text-left", FOCUS)}>
        {head}
        <Chevron />
      </CollapsibleTrigger>
      <EntryAsks entry={entry} />
      <CollapsibleContent>
        <EntryBody entry={entry} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** What a stop or row holds, said once each. */
export function EntryBody({ entry }: { entry: RoadEntry }) {
  const when = useItemWhen();
  const said = [entry.title, ...entry.lines, ...(entry.flag ? [entry.flag.text] : [])];
  const shared = entry.shared ? unsaid(entry.shared, said) : null;
  const detail = (i: PlanItem) => (entry.shared ? null : unsaid(i.detail, said));
  // The flag's own item first: its detail explains the headline ("Taken Mar 2026, so 2 years old by …").
  const flagItem = entry.flag?.item && entry.items.includes(entry.flag.item) ? entry.flag.item : null;
  const items = flagItem ? [flagItem, ...entry.items.filter((i) => i !== flagItem)] : entry.items;
  // Items with a name of their own (each programme) are listed by it, linked to their page; the others
  // add their detail and links.
  const named = entry.kind === "item" ? [] : items.filter((i) => !said.includes(i.short));
  const plain = items.filter((i) => !named.includes(i));
  // One date line for the list when every programme shares it (none when it is the stop's own).
  const sameWhen = named.length > 1 && named.every((i) => when(i) === when(named[0]) && i.basis === named[0].basis);
  const lead = sameWhen && !(when(named[0]) === entry.when && named[0].basis === entry.basis);
  // The official quotes, once each (the English rule sits on both the retake and the expiry).
  const rules = [...new Map(items.flatMap((i) => i.rules ?? []).map((r) => [`${r.label}|${r.quote}`, r] as [string, PlanRule])).values()];
  // Links, once each, except the same event on several dates: each date is its own link, labelled by
  // that date, even when the dates share a page, so no two links read the same.
  const seen = new Set<string>();
  const fresh = (url: string | null): url is string => !!url && !seen.has(url) && !!seen.add(url);
  const lists = plain.flatMap((i) => (i.links ?? []).filter((l) => fresh(l.url)));
  const eventDates = entry.kind === "item" && plain.length > 1 && plain.every((i) => i.lane === "events" && !!i.url);
  const own = plain.filter((i) => fresh(i.url) || (eventDates && !!i.url));
  const texts = [...new Set([shared, ...plain.map((i) => detail(i))].filter((x): x is string => !!x))];

  return (
    <div className="mt-2.5 flex flex-col gap-3 text-[15px] leading-relaxed text-(--land-body)">
      {texts.map((x, i) => (
        <p key={i} className="text-pretty">
          {x}
        </p>
      ))}
      {lists.length > 0 && (
        <ul className="flex flex-col gap-1">
          {lists.map((l) => (
            <li key={l.url} className="text-[14px]">
              <OutLink href={l.url}>{l.label}</OutLink>
              {l.note && <span className="text-muted-foreground"> · {l.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {own.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {own.map((i) =>
            eventDates ? (
              <OutLink key={i.id} href={i.url!} item={i.short}>
                {when(i)}
              </OutLink>
            ) : (
              <ItemLink key={i.id} url={i.url!} item={`${i.short}, ${when(i)}`} />
            ),
          )}
        </p>
      )}
      {entry.tip && <p className="text-pretty">{entry.tip}</p>}
      {named.length > 0 && (
        <div className="flex flex-col gap-2">
          {lead && <When when={when(named[0])} basis={named[0].basis} />}
          <ul className="flex flex-col gap-2.5">
            {named.map((i) => {
              const text = detail(i);
              return (
                <li key={i.id} className="flex flex-col gap-0.5">
                  {i.url ? (
                    <span>
                      <OutLink href={i.url} className="text-[15px] leading-snug">
                        {i.short}
                      </OutLink>
                    </span>
                  ) : (
                    <span className="text-[15px] leading-snug font-medium text-pretty text-foreground">{i.short}</span>
                  )}
                  {!sameWhen && <When when={when(i)} basis={i.basis} />}
                  {text && <p className="text-[14px] text-pretty">{text}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {rules.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rules.map((r) => (
            <RuleQuote key={`${r.label}|${r.quote}`} rule={r} link={!r.url || !seen.has(r.url)} />
          ))}
        </div>
      )}
      {entry.rows.length > 0 && (
        <ul className="divide-y divide-(--land-line) border-y border-(--land-line)">
          {entry.rows.map((r) => (
            <li key={r.id}>
              <StopRow entry={r} />
            </li>
          ))}
        </ul>
      )}
      {entry.awards.length > 0 && <Awards groups={entry.awards} />}
    </div>
  );
}
