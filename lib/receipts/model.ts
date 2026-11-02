import shotsFile from "@/data/raw/receipt-shots.json";
import type { FactRow, QuoteKind as FactQuoteKind } from "@/lib/careers/types";
import { SOURCES, type Receipt } from "@/lib/home/receipts";

// One receipt model for the whole site (plan §2.6, decisions Q18 and C6). Every receipt, whichever store it
// comes from, becomes a ReceiptView before it reaches the shared receipt UI (components/shared/receipt):
//   - fromRegistry: the hand-checked registry (lib/home/receipts.ts) plus its photos (data/raw/receipt-shots.json);
//   - fromFact: a career_facts row (lib/careers/types.ts FactRow);
//   - fromRule: a rule, reading, mapping, match or count of our own ("Kaplan 360++'s rule: …").
// Plain TypeScript: server components convert and pass ReceiptView[] down as props; client code may convert
// registry ids itself. "Matched word for word" is only ever claimed for match "word-for-word" (text compared);
// a figure read from a page image is never called a word-for-word match (C4).

export type ReceiptView = {
  id: string;
  kind: "official" | "reported" | "person" | "report" | "platform" | "rule";
  /** Verbatim; null for kind "rule". */
  quote: string | null;
  /** The value(s) highlighted. */
  mark: string[];
  quoteKind: "sentence" | "table-row" | "table-text" | "table-image" | "xlsx-row" | "chart-label" | "infographic-label" | "rule";
  publisher: string;
  title: string;
  /** ISO date or as printed. */
  published: string | null;
  /** ISO date. Empty for a rule with no read date. */
  read: string;
  url: string | null;
  host: string | null;
  /** "Table 3, p. 26" / "Sheet T4.6, row 41". */
  where: string | null;
  shot: { src: string; width: number; height: number } | null;
  match: "word-for-word" | "row" | "page-image" | "rule";
  note?: string;
  /** Registry receipts only: what the sentence is about (lib/home/receipts.ts `context`, a msg() string). */
  context?: string;
};

export type ReceiptMatch = ReceiptView["match"];

/** Our own name, as the publisher of a rule. */
export const OWN_PUBLISHER = "Kaplan 360++";

type Shot = { id: string; status: string; checked: string; file?: string; width?: number; height?: number };
const SHOTS = new Map((shotsFile as { shots: Shot[] }).shots.map((s) => [s.id, s]));

/** The host of a URL without "www.", or null. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * A registry receipt (lib/home/receipts.ts). Official quotes are checked word for word against their live page
 * (scripts/receipts/capture.ts). A report of a notice and a person's transcription are not text-compared with the
 * notice itself: their kind says so on the card ("reported" / "person"), and their match is "page-image".
 */
export function fromRegistry(r: Receipt): ReceiptView {
  const s = SHOTS.get(r.id);
  const shot = s?.file && s.width && s.height ? { src: s.file, width: s.width, height: s.height } : null;
  return {
    id: r.id,
    kind: r.kind,
    quote: r.quote ?? null,
    mark: r.mark ?? [],
    quoteKind: "sentence",
    publisher: SOURCES[r.source].name,
    title: r.sourceTitle,
    published: null,
    read: s?.status === "found" ? s.checked : r.read,
    url: r.url,
    host: r.host || hostOf(r.url),
    where: null,
    shot,
    match: r.kind === "official" && r.quote ? "word-for-word" : "page-image",
    ...(r.note ? { note: r.note } : {}),
    context: r.context,
  };
}

const IMAGE_KINDS: ReadonlySet<FactQuoteKind> = new Set<FactQuoteKind>(["table-image", "chart-label", "infographic-label"]);

/** How a fact's quote was matched. Image-read kinds are never "word-for-word", whatever the verifier said. */
export function factMatch(f: Pick<FactRow, "quoteKind" | "verifiedBy">): ReceiptMatch {
  if (IMAGE_KINDS.has(f.quoteKind) || f.verifiedBy === "page-image") return "page-image";
  return f.verifiedBy === "row-rebuilt" ? "row" : "word-for-word";
}

/** A career_facts row. */
export function fromFact(f: FactRow): ReceiptView {
  const where = f.whereRef ?? (f.page != null ? `p. ${f.page}` : null);
  return {
    id: f.id,
    kind: f.sourceKind,
    quote: f.quote,
    mark: f.mark,
    quoteKind: f.quoteKind,
    publisher: f.publisher,
    title: f.title,
    published: f.publishedOn ?? f.published,
    read: f.readOn,
    url: f.url,
    host: hostOf(f.url),
    where,
    shot: null,
    match: factMatch(f),
    ...(f.note ? { note: f.note } : {}),
  };
}

/**
 * A rule, reading, mapping, match or count of our own. `text` is the sentence itself, starting
 * "Kaplan 360++'s rule: …" (or reading / mapping / match / count); the card shows it in full as the title.
 * `opts.read` is the ISO date the rule was applied to the data (e.g. the dataset's build date), when known.
 */
export function fromRule(id: string, text: string, opts: { read?: string; url?: string | null; where?: string | null } = {}): ReceiptView {
  const url = opts.url ?? null;
  return {
    id,
    kind: "rule",
    quote: null,
    mark: [],
    quoteKind: "rule",
    publisher: OWN_PUBLISHER,
    title: text,
    published: null,
    read: opts.read ?? "",
    url,
    host: hostOf(url),
    where: opts.where ?? null,
    shot: null,
    match: "rule",
  };
}

/** Views in first-seen order with duplicate ids dropped: the order a ReceiptSection numbers them in. */
export function uniqueViews(views: readonly ReceiptView[]): ReceiptView[] {
  const seen = new Set<string>();
  return views.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
}
