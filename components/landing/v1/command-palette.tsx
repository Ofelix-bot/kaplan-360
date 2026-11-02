"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CornerDownLeftIcon, MessageSquareTextIcon, ReceiptTextIcon, RotateCcwIcon, ScrollTextIcon, SearchIcon, UserRoundIcon } from "lucide-react";
import { useLocalize, useT } from "@/components/i18n/I18nProvider";
import { Command, CommandCollection, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogBackdrop, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { DEFAULT_PRIORITIES, RULES, type Residency } from "@/lib/home/content";
import { RECEIPTS } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import { openExample } from "@/lib/plan-storage";
import { PERSONAS } from "@/lib/personas";
import { SECTIONS } from "./floating-nav";
import { useSourceName } from "../receipts";

// ⌘K (Ctrl+K): everything on the page in one searchable list: jump to a section, open a rule or a
// receipt, see an example student's programmes, or start. Arrow keys and Enter, or the pointer.

type Item = {
  value: string;
  label: string;
  hint?: string;
  /** More words to match: a rule's text, a receipt's quote and source. */
  keywords?: string;
  icon: typeof SearchIcon;
  run: () => void;
};

/** Lower case, accents dropped, so "e" finds "é". */
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Every word typed must appear in the item's label, hint or keywords. */
const matches = (item: Item, query: string) => {
  const hay = fold([item.label, item.hint, item.keywords].filter(Boolean).join(" "));
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
};
type Group = { value: string; items: Item[] };

export function CommandPalette({ residency }: { residency: Residency }) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalize();
  const source = useSourceName();
  const open = useHome((s) => s.paletteOpen);
  const setOpen = useHome((s) => s.setPaletteOpen);
  const setOpenRule = useHome((s) => s.setOpenRule);
  const showReceipts = useHome((s) => s.showReceipts);
  const setPriorities = useHome((s) => s.setPriorities);
  const setStudent = useHome((s) => s.setStudent);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useHome.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const groups = useMemo<Group[]>(() => {
    const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ block: "start" });
    return [
      {
        value: t("Sections"),
        items: SECTIONS.map((s, i) => ({ value: `section-${s.id}`, label: t(s.label), hint: `0${i + 1}`, icon: s.icon, run: () => scroll(s.id) })),
      },
      {
        value: t("Hidden rules"),
        items: RULES.filter((r) => r.audience.includes(residency)).map((r) => ({
          value: `rule-${r.id}`,
          label: t(r.title),
          hint: t(r.tag),
          keywords: [t(r.body), ...r.receipts.map((id) => (RECEIPTS[id] ? source(RECEIPTS[id].source).label : ""))].join(" "),
          icon: ScrollTextIcon,
          run: () => {
            document.querySelector(`[data-select-id="${r.id}"]`)?.scrollIntoView({ block: "center" });
            requestAnimationFrame(() => setOpenRule(r.id));
          },
        })),
      },
      {
        value: t("Receipts"),
        items: Object.values(RECEIPTS).map((r) => ({
          value: `receipt-${r.id}`,
          label: t(r.context),
          hint: source(r.source).label,
          keywords: [r.quote ?? "", source(r.source).name, r.host].join(" "),
          icon: ReceiptTextIcon,
          run: () => showReceipts([r.id], t(r.context)),
        })),
      },
      {
        value: t("Example students"),
        items: PERSONAS.map((p) => ({
          value: `student-${p.id}`,
          label: t("{name}’s programmes", { name: p.name }),
          hint: t(p.now),
          keywords: t(p.goal),
          icon: UserRoundIcon,
          run: () => {
            openExample(p.id, p.answers(new Date()));
            router.push(localize("/results"));
          },
        })),
      },
      {
        value: t("Actions"),
        items: [
          { value: "start-planning", label: t("Start planning"), icon: ArrowRightIcon, run: () => router.push(localize("/results")) },
          {
            value: "describe",
            label: t("Describe yourself in one sentence"),
            icon: MessageSquareTextIcon,
            run: () => {
              setStudent(null);
              scroll("describe");
            },
          },
          {
            value: "reset-order",
            label: t("Reset the order of what matters"),
            icon: RotateCcwIcon,
            run: () => {
              setPriorities(DEFAULT_PRIORITIES);
              toast.add({ title: t("Order reset") });
            },
          },
        ],
      },
    ];
  }, [t, residency, source, setOpenRule, showReceipts, router, localize, setPriorities, setStudent]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogBackdrop className="transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogViewport className="items-start pt-[12vh]">
          <DialogPopup className="max-w-xl origin-top transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <DialogTitle className="sr-only">{t("Search this page")}</DialogTitle>
            <Command open inline items={groups} filter={matches} autoHighlight="always" keepHighlight>
              <div className="flex items-center gap-2 border-b px-4">
                <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <CommandInput aria-label={t("Search this page")} placeholder={t("Search rules, receipts and sections…")} />
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">Esc</kbd>
              </div>
              <div className="max-h-[min(28rem,60vh)] overflow-y-auto overscroll-contain">
                <CommandEmpty>{t("Nothing on this page matches.")}</CommandEmpty>
                <CommandList>
                  {(group: Group) => (
                    <CommandGroup key={group.value} items={group.items}>
                      <CommandGroupLabel>{group.value}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: Item) => (
                          <CommandItem
                            key={item.value}
                            value={item}
                            onClick={() => {
                              setOpen(false);
                              item.run();
                            }}
                          >
                            <item.icon aria-hidden className="text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.hint && <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">{item.hint}</span>}
                          </CommandItem>
                        )}
                      </CommandCollection>
                    </CommandGroup>
                  )}
                </CommandList>
              </div>
              <div className="flex items-center gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CornerDownLeftIcon aria-hidden className="size-3.5" />
                  {t("to open")}
                </span>
                <span>↑ ↓ {t("to move")}</span>
              </div>
            </Command>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
