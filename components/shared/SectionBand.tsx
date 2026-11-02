"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";

// The light in-page band under the site header (after /insights' RoadsBar): the page's name and a
// link per section, numbered where the section is a step. It sticks under the header
// (top --header-h, height --band-h), translucent like the header. The section crossing the strip
// just under it is marked (IntersectionObserver, aria-current="location", a brand-ink underline).
// Sections are looked up inside this page's root, never document-wide: a page kept hidden by
// Activity can hold the same ids. On phones the links scroll sideways inside the band.
// An item may carry sub-sections (`children`): they sit in a smaller, lighter row under it, their text
// lined up with the item's label (past its step number), and the band grows a row to hold them: the
// page sets --band-h to match (components/landing/move/MovePage.tsx). A sub-section in view marks
// both itself and its item.

type Sub = { id: string; label: string };
type Item = { id: string; label: string; step?: string; children?: Sub[] };

/** A length token in px, as `el` inherits it; `fallback` when it is missing. */
function tokenPx(el: Element, name: string, fallback: number) {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const FOCUS = "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid";
const EASE = "transition-colors duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-none";

/** `label` and the items' labels are English messages, translated here. */
/** `subRows={false}`: sub-sections are tracked (they mark their item) but not shown as links. */
export function SectionBand({ label, items, end, subRows = true }: { label: string; items: Item[]; end?: React.ReactNode; subRows?: boolean }) {
  const t = useT();
  const nav = useRef<HTMLElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  // Every section in page order: each item, then its sub-sections.
  const ids = items.flatMap((i) => [i.id, ...(i.children ?? []).map((c) => c.id)]).join(" ");
  const nested = subRows && items.some((i) => i.children?.length);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const order = ids.split(" ");
    // The page root: the child of <main> holding this band, else the band's parent.
    const root = el.closest("main > *") ?? el.parentElement ?? el;
    const targets = order.map((id) => root.querySelector<HTMLElement>(`#${CSS.escape(id)}`)).filter((e): e is HTMLElement => !!e);
    const top = tokenPx(el, "--header-h", 68) + tokenPx(el, "--band-h", 56);
    const seen = new Map<string, boolean>();
    // A strip from just under the band to 45% down the screen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const on = order.filter((id) => seen.get(id)).at(-1);
        setActive(on ?? null);
      },
      { rootMargin: `-${top}px 0px -55% 0px` },
    );
    targets.forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [ids]);

  // Keep the marked link in view where the links scroll sideways.
  useEffect(() => {
    const box = strip.current;
    if (!active || !box || box.scrollWidth <= box.clientWidth) return;
    const link = box.querySelector<HTMLElement>(`[data-band-item="${CSS.escape(active)}"]`);
    if (!link) return;
    const a = link.getBoundingClientRect(),
      b = box.getBoundingClientRect();
    if (a.left < b.left || a.right > b.right) box.scrollBy({ left: a.left < b.left ? a.left - b.left - 16 : a.right - b.right + 16 });
  }, [active]);

  return (
    <nav
      ref={nav}
      aria-label={t(label)}
      className={cn(
        "sticky top-(--header-h) z-40 h-(--band-h) border-b border-solid border-(--land-line) text-(--text)",
        "bg-[color-mix(in_oklab,var(--land-ground)_84%,transparent)] backdrop-blur-md backdrop-saturate-150",
        "[@media(prefers-reduced-transparency:reduce)]:bg-(--land-ground) [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none contrast-more:bg-(--land-ground) contrast-more:backdrop-blur-none",
      )}
    >
      {/* With sub-sections everything hangs from a 48px top row and the sub-rows sit under it. */}
      <div className={cn("home-wrap flex h-full gap-6", nested ? "items-start" : "items-center")}>
        <p className={cn("m-0 shrink-0 font-heading text-[15px] [font-stretch:var(--display-stretch)] font-bold whitespace-nowrap min-[900px]:text-base", nested && "flex h-12 items-center")}>{t(label)}</p>
        {/* Sideways only: a strip that could scroll even 1px down would swallow the page's first wheel tick. */}
        <div ref={strip} className="-mr-4 flex h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] min-[720px]:mr-0 [&::-webkit-scrollbar]:hidden">
          <ul className={cn("m-0 ml-auto flex list-none gap-1 p-0 pr-4 min-[720px]:pr-0", nested ? "items-start" : "h-full items-stretch")}>
            {items.map((item) => {
              const subs = subRows ? (item.children ?? []) : [];
              const subOn = (item.children ?? []).some((s) => s.id === active);
              const on = active === item.id || subOn;
              return (
                <li key={item.id} className={cn("flex", nested && "flex-col")} data-band-item={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active === item.id ? "location" : undefined}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 text-[14px] font-semibold whitespace-nowrap no-underline min-[900px]:px-3.5",
                      nested && "h-12",
                      EASE,
                      FOCUS,
                      on ? "text-(--text)" : "text-(--muted) hover:text-(--text)",
                    )}
                  >
                    {item.step && <span className="text-(--accent-ink) tabular-nums">{item.step}</span>}
                    {t(item.label)}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-3 bottom-0 h-0.5 bg-(--brand-ink) transition-opacity duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-none min-[900px]:inset-x-3.5",
                        on ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </a>
                  {subs.length > 0 && (
                    // Indented past the step: an invisible copy of the number, at the item's size and
                    // weight, holds the sub-row's first link to where the item's label starts.
                    <div className="flex h-[27px] items-stretch gap-1.5 px-3 min-[900px]:px-3.5">
                      {item.step && (
                        <span aria-hidden className="invisible text-[14px] font-semibold tabular-nums">
                          {item.step}
                        </span>
                      )}
                      <ul className="m-0 flex list-none items-stretch gap-3.5 p-0">
                        {subs.map((s) => {
                          const sOn = active === s.id;
                          return (
                            <li key={s.id} className="flex" data-band-item={s.id}>
                              <a
                                href={`#${s.id}`}
                                aria-current={sOn ? "location" : undefined}
                                className={cn(
                                  "relative flex items-center text-[13px] font-medium whitespace-nowrap no-underline",
                                  EASE,
                                  FOCUS,
                                  sOn ? "text-(--text)" : "text-[color-mix(in_oklab,var(--muted)_80%,var(--land-ground))] hover:text-(--text)",
                                )}
                              >
                                {t(s.label)}
                                <span
                                  aria-hidden
                                  className={cn(
                                    "absolute inset-x-0 bottom-1 h-px bg-(--brand-ink) transition-opacity duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-none",
                                    sOn ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {end && <div className="flex shrink-0 items-center">{end}</div>}
      </div>
    </nav>
  );
}
