import { cn } from "cn";

// A figure as its source prints it ("4.3 per cent", "US$34.5 trillion", "more than 95%"), set so the number
// carries the size: the words before or after it are set smaller on its line, and the number never breaks
// inside. A figure with no digit at all (a job title a report ranks) is set as a short line of text instead.
// Display only: the words stay the source's, and the receipt quotes them whole. No hooks, so the server
// components (DemandSignals) and the client ones (Stat) share it.

/** Lead words, then the number with its currency or sign and a short unit ("%", "B", "rd", "+"), then the rest. */
const FIGURE = /^(.*?)((?:[A-Z]{0,3}\$|[+\-−~])?\d[\d,.]*(?:%|\+|[A-Za-z]{1,2}\b)?)(.*)$/;

export function FigureText({ value, className }: { value: string; className?: string }) {
  const m = value.match(FIGURE);
  if (!m) return <span className={cn("block text-[0.5em] leading-[1.15] tracking-normal text-balance", className)}>{value}</span>;
  const lead = m[1].trim();
  const num = m[2];
  const tail = m[3].trim();
  const words = "text-[0.42em] leading-[1.1] font-semibold tracking-normal";
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-baseline gap-x-[0.2em]", className)}>
      {lead && <span className={words}>{lead}</span>}
      <span className={cn("whitespace-nowrap", num.length >= 7 && "text-[0.82em]")}>{num}</span>
      {tail && <span className={words}>{tail}</span>}
    </span>
  );
}
