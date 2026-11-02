import { CheckIcon } from "lucide-react";

// Tile 1: an official page, one sentence highlighted; a line draws from it to the figure it gives, then
// "Matched word for word" with the date the sentence was last found on its page. 8s loop (globals.css .hb-receipt).

export function ReceiptVisual({ value, label, source, matched, date }: { value: string; label: string; source: string; matched: string; date: string }) {
  return (
    <div className="hb-v hb-receipt">
      <div className="hb-page">
        <span className="hb-bar hb-bar-head" />
        <span className="hb-bar hb-w60" />
        <span className="hb-bar hb-w95" />
        <span className="hb-bar hb-w85" />
        <span className="hb-line-hit">
          <span className="hb-sweep" />
          <span className="hb-bar hb-bar-hit" />
        </span>
        <span className="hb-bar hb-w90" />
        <span className="hb-bar hb-w80" />
        <span className="hb-bar hb-w55" />
      </div>
      <svg className="hb-wire" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path d="M0 78 C 50 78, 50 30, 100 30" pathLength={100} />
      </svg>
      <div className="hb-side">
        <div className="hb-stat">
          <b>{value}</b>
          <span>{label}</span>
          <span className="hb-src">{source}</span>
        </div>
        <div className="hb-matched">
          <CheckIcon aria-hidden className="hb-matched-icon" strokeWidth={2.75} />
          <span>{matched}</span>
          <time>{date}</time>
        </div>
      </div>
    </div>
  );
}
