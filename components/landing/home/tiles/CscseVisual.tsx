import { CheckIcon, UserRoundSearchIcon } from "lucide-react";

// Tile 7: CSCSE's notice (its own Chinese title) beside a person reading it, and a pulsing
// "Checked by a person" chip. 4s loop.

export function CscseVisual({ title, chip }: { title: string; chip: string }) {
  return (
    <div className="hb-v hb-cscse">
      <div className="hb-notice">
        <b>CSCSE</b>
        <span lang="zh-Hans" className="hb-notice-title">
          {title}
        </span>
        <span className="hb-bar hb-w90" />
        <span className="hb-bar hb-w70" />
      </div>
      <div className="hb-reader">
        <span className="hb-reader-pulse" />
        <UserRoundSearchIcon aria-hidden className="hb-reader-icon" strokeWidth={1.75} />
      </div>
      <span className="hb-person-chip">
        <CheckIcon aria-hidden className="hb-person-chip-icon" strokeWidth={2.75} />
        {chip}
      </span>
    </div>
  );
}
