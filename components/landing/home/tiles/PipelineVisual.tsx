// Tile 3: Read, Pick out, Match, Drop, with dots flowing along it; one falls into Drop. 4s loop.
// `n` is the pages read (lib/changes.ts), formatted; the stage names come translated.

const XS = [30, 117, 204, 290];

export function PipelineVisual({ n, stages }: { n: string; stages: [string, string, string, string] }) {
  return (
    <div className="hb-v hb-pipe">
      <svg viewBox="0 0 320 120" focusable="false">
        <path className="hb-pipe-rail" d="M30 54 H290" />
        {XS.map((x, i) => (
          <circle key={x} className={i === 3 ? "hb-pipe-stop hb-pipe-out" : "hb-pipe-stop"} cx={x} cy={54} r={17} />
        ))}
        <text className="hb-pipe-n" x={30} y={58} textAnchor="middle">
          {n}
        </text>
        <circle className="hb-pipe-pick" cx={117} cy={54} r={5} />
        <path className="hb-pipe-tick" d="M198 54 l4 4 7 -8" />
        <path className="hb-pipe-x" d="M284 48 l12 12 M296 48 l-12 12" />
        {stages.map((s, i) => (
          <text key={s} className="hb-pipe-label" x={XS[i]} y={96} textAnchor="middle">
            {s}
          </text>
        ))}
        {[0, 0.8, 1.6, 3.2].map((d) => (
          <circle key={d} className="hb-pipe-dot" cx={30} cy={54} r={4.5} style={{ animationDelay: `${d}s` }} />
        ))}
        <circle className="hb-pipe-dot hb-pipe-dot-drop" cx={30} cy={54} r={4.5} style={{ animationDelay: "2.4s" }} />
      </svg>
    </div>
  );
}
