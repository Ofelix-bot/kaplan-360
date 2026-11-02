// The student's plan as files they keep: a one-page A4 PDF (drawn in the browser with jsPDF, loaded
// only when asked for), the one place the six-lane chart is kept, and an .ics calendar of every date
// still ahead, with reminders. Both are made on the device; nothing is uploaded.

import { makeT, type T } from "@/lib/i18n/translate";
import { LANES, monthOf, type Plan, type PlanItem } from "@/lib/plan-timeline";

const BASIS = { official: "Official", typical: "Estimated", yours: "Yours" } as const;

/** jsPDF's built-in fonts cover Windows-1252 only: other characters are dropped or replaced. */
const latinText = (s: string) =>
  s
    .replace(/[≈]/g, "~")
    .replace(/[\u2190-\u21ff]/g, "->")
    .replace(/[^\x20-\x7e\u00a0-\u00ff‘’“”–—…·•€]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();

/** Chinese pages draw with a subset of Noto Sans (SIL OFL), fetched only when a PDF is made. */
const CJK_FONT: Record<string, string> = { "zh-Hans": "/fonts/plan-zh-hans.ttf", "zh-Hant": "/fonts/plan-zh-hant.ttf" };

async function fontData(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function downloadPdf(plan: Plan, who: string, today: string, t: T = makeT({}), locale = "en-SG") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cjk = Object.keys(CJK_FONT).find((k) => locale.startsWith(k));
  // One face for both weights on Chinese pages (the subset has regular only).
  const face = cjk ? "NotoSansCJK" : "helvetica";
  if (cjk) {
    doc.addFileToVFS("plan-cjk.ttf", await fontData(CJK_FONT[cjk]));
    doc.addFont("plan-cjk.ttf", face, "normal");
    doc.addFont("plan-cjk.ttf", face, "bold");
  }
  const pdfText = (s: string) => (cjk ? s.replace(/\s{2,}/g, " ").trim() : latinText(s));
  const monthLabel = (m: number) => new Date(Date.UTC(Math.floor(m / 12), m % 12, 1)).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const dateText = (i: PlanItem) => {
    const d = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    return i.to ? `${d(i.from)} – ${d(i.to)}` : d(i.from);
  };
  const W = 210, M = 14;
  const ink = [22, 19, 43] as const, muted = [90, 86, 117] as const, emph = [36, 15, 110] as const, soft = [189, 185, 208] as const, accent = [255, 181, 71] as const;

  doc.setFont(face, "bold").setFontSize(18).setTextColor(...ink).text(t("Your plan"), M, 20);
  doc.setFont(face, "normal").setFontSize(9).setTextColor(...muted);
  doc.text(
    (doc.splitTextToSize(pdfText(`${who} · ${t("{from} to {to} · made {date} on Kaplan 360++", { from: monthLabel(plan.from), to: monthLabel(plan.end), date: today })}`), W - 2 * M) as string[]).slice(0, 1),
    M,
    26,
  );

  // The timeline: one row per lane, months across, to the last start on the shortlist.
  const x0 = M + 26, x1 = W - M, top = 33, rowH = 7;
  const span = Math.max(1, plan.end + 1 - plan.from);
  const xAt = (iso: string, endOfDay = false) => {
    const t = monthOf(iso) + (Number(iso.slice(8, 10)) - 1 + (endOfDay ? 1 : 0)) / 31;
    return x0 + (Math.min(Math.max(t - plan.from, 0), span) / span) * (x1 - x0);
  };
  doc.setFontSize(7);
  for (let m = plan.from; m <= plan.end + 1; m++) {
    const x = x0 + ((m - plan.from) / span) * (x1 - x0);
    doc.setDrawColor(231, 229, 239).setLineWidth(0.2).line(x, top, x, top + LANES.length * rowH);
    if ((m % 12 === 0 || m === plan.from) && x < x1 - 4) doc.setTextColor(...muted).text(String(Math.floor(m / 12)), x + 0.8, top - 1.5);
    else if (m % 3 === 0 && x < x1 - 4) doc.setTextColor(...muted).text(new Date(Date.UTC(2026, m % 12, 1)).toLocaleDateString(locale, { month: "short", timeZone: "UTC" }), x + 0.8, top - 1.5);
  }
  LANES.forEach((lane, r) => {
    const y = top + r * rowH;
    doc.setTextColor(...ink).setFont(face, "bold").setFontSize(7.5).text(t(lane.label), M, y + 4.6);
    doc.setFont(face, "normal");
    for (const i of plan.items.filter((x) => x.lane === lane.id)) {
      const a = xAt(i.from);
      const color: readonly [number, number, number] = i.key ? emph : i.basis === "typical" ? soft : emph;
      if (i.to) {
        const b = Math.max(a + 0.8, xAt(i.to, true));
        doc.setFillColor(...color).roundedRect(a, y + 2, b - a, 3, 0.8, 0.8, "F");
      } else {
        const dot: readonly [number, number, number] = i.key ? accent : emph;
        doc.setFillColor(...dot).circle(a, y + 3.5, 1.3, "F");
      }
    }
  });

  // What to do, month by month, in two columns.
  let y = top + LANES.length * rowH + 8;
  const colW = (W - 2 * M - 6) / 2;
  let col = 0;
  const bottom = 280;
  const byMonth = new Map<string, PlanItem[]>();
  for (const i of plan.items) {
    const k = monthLabel(Math.max(monthOf(i.from), plan.from));
    byMonth.set(k, [...(byMonth.get(k) ?? []), i]);
  }
  const x = () => M + col * (colW + 6);
  let full = false;
  for (const [month, list] of byMonth) {
    if (full) break;
    if (y > bottom - 10) {
      if (col === 1) break;
      col = 1;
      y = top + LANES.length * rowH + 8;
    }
    doc.setFont(face, "bold").setFontSize(9).setTextColor(...emph).text(month, x(), y);
    y += 4;
    for (const i of list) {
      doc.setFont(face, "bold").setFontSize(8);
      const title = doc.splitTextToSize(pdfText(i.title), colW - 2) as string[];
      const meta = pdfText(`${dateText(i)} · ${t(LANES.find((l) => l.id === i.lane)!.label)} · ${t(BASIS[i.basis])}`);
      doc.setFont(face, "normal").setFontSize(7);
      // Whole sentences only, up to three lines.
      // A sentence ends at . ! or ? (or one closed by a quote or bracket) followed by a space, so "6.5" stays
      // whole; in Chinese, at 。！？ with no space.
      const sentences = pdfText(i.detail).split(cjk ? /(?<=[。！？])/ : /(?<=[.!?][”"’)]?)\s+/);
      let detail: string[] = [];
      for (const s of sentences) {
        const next = doc.splitTextToSize(sentences.slice(0, sentences.indexOf(s) + 1).join(cjk ? "" : " "), colW - 2) as string[];
        if (next.length > 3 && detail.length) break;
        detail = next.slice(0, 3);
      }
      const h = title.length * 3.4 + 3.2 + detail.length * 3 + 2;
      if (y + h > bottom) {
        if (col === 1) {
          full = true;
          break;
        }
        col = 1;
        y = top + LANES.length * rowH + 8;
      }
      doc.setFont(face, "bold").setFontSize(8).setTextColor(...ink).text(title, x(), y);
      y += title.length * 3.4;
      doc.setFont(face, "normal").setFontSize(7).setTextColor(...muted).text(meta, x(), y);
      y += 3.2;
      doc.setTextColor(...ink).text(detail, x(), y);
      y += detail.length * 3 + 2;
    }
    y += 2;
  }

  doc.setFontSize(6.5).setTextColor(...muted);
  const foot = doc.splitTextToSize(
    pdfText(
      [...plan.notes, t("Dates come from official pages (Official), your own answers (Yours) or a rule of thumb (Estimated). Always check the official page before you apply.")].join(" "),
    ),
    W - 2 * M,
  ) as string[];
  doc.text(foot.slice(0, 5), M, 297 - 6 - (Math.min(foot.length, 5) - 1) * 2.6);
  doc.save(`my-plan-${today}.pdf`);
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** Lines longer than 75 octets are folded (RFC 5545), never inside a character. */
const fold = (line: string) => {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  return [...out, cur].join("\r\n ");
};
const day = (iso: string) => iso.replace(/-/g, "");
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

/** Reminders (RFC 5545 VALARM) for an all-day entry: before a deadline, 14 and 2 days ahead; before an event, 09:00 the day before. */
const alarms = (kind: "deadline" | "event" | null, summary: string) =>
  (kind === "deadline" ? ["-P14D", "-P2D"] : kind === "event" ? ["-PT15H"] : []).flatMap((trigger) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(summary)}`, `TRIGGER:${trigger}`, "END:VALARM"]);

/**
 * The plan as an iCalendar file: every dated item still ahead (a window as its start and its end; a
 * start already passed is left out), each with the item's detail, the rule behind a worked-out date,
 * the official pages' own words, its basis and link. Deadlines (an item's `due` date, or a key date) remind 14 and 2 days before; events
 * at 09:00 the day before.
 */
export function planIcs(plan: Plan, today: string, t: T = makeT({})): string {
  const stamp = `${day(today)}T000000Z`;
  const events: string[] = [];
  const add = (uid: string, date: string, summary: string, i: PlanItem, kind: "deadline" | "event" | null) => {
    if (date < today) return;
    const quotes = (i.rules ?? []).map((r) => `${r.label}: “${r.quote}”`);
    const links = (i.links ?? []).map((l) => `${l.label}: ${l.url}`);
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:${uid}@kaplan360pp`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day(date)}`,
        `DTEND;VALUE=DATE:${nextDay(date)}`,
        `SUMMARY:${icsText(summary)}`,
        `DESCRIPTION:${icsText([i.detail, ...quotes, ...links, `(${t(BASIS[i.basis])})`].filter(Boolean).join("\n"))}`,
        ...(i.url && /^https?:/.test(i.url) ? [`URL:${i.url}`] : []),
        ...alarms(kind, summary),
        "END:VEVENT",
      ]
        .map(fold)
        .join("\r\n"),
    );
  };
  for (const i of plan.items) {
    const deadline = (date: string) => date === i.due || (!!i.key && (i.to ? date === i.to : date === i.from));
    if (i.to) {
      // A window under way has already started: only its end is ahead.
      if (i.from > today) add(`${i.id}-from`, i.from, t("{title}: starts", { title: i.title }), i, null);
      add(`${i.id}-to`, i.to, t(i.key ? "{title}: deadline" : "{title}: ends", { title: i.title }), i, deadline(i.to) ? "deadline" : null);
    } else add(i.id, i.from, i.title, i, i.lane === "events" ? "event" : deadline(i.from) ? "deadline" : null);
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kaplan 360++//Your plan//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function downloadIcs(plan: Plan, today: string, t: T = makeT({})) {
  const url = URL.createObjectURL(new Blob([planIcs(plan, today, t)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-plan-${today}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
