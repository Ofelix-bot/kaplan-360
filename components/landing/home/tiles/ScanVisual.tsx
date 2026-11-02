import { StatusChip } from "@/components/shared/StatusChip";

// Tile 2: a scan line runs down a page; what the page says pops out as checked chips ("Fees",
// "Entry requirements", "Deadlines"); "Not on the page" is crossed out and drops. 4.8s loop.
// Labels are English messages (StatusChip translates them). `note`: a line under it (the pages read and when).

export function ScanVisual({ found, missing, note }: { found: string[]; missing: string; note?: string }) {
  return (
    <div className="hb-v hb-scan">
      <div className="hb-page">
        <span className="hb-bar hb-bar-head" />
        <span className="hb-bar hb-w90" />
        <span className="hb-bar hb-w80" />
        <span className="hb-bar hb-w95" />
        <span className="hb-bar hb-w70" />
        <span className="hb-bar hb-w85" />
        <span className="hb-scanline" />
      </div>
      <ul className="hb-chips">
        {found.map((label, i) => (
          <li key={label} className="hb-chip" style={{ animationDelay: `${0.2 + i * 0.8}s` }}>
            <StatusChip state="holds" label={label} />
          </li>
        ))}
        <li className="hb-chip hb-chip-drop">
          <StatusChip state="out" label={missing} className="line-through" />
        </li>
      </ul>
      {note && <span className="hb-scan-note">{note}</span>}
    </div>
  );
}
