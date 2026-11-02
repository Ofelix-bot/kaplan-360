// Tile 4: your degree branching into the six doors of 01 · Look (content/landing.en.ts CARDS), the lines
// drawing in turn and each door lighting. 6s loop. `doors` come translated, in CARDS order.

const YS = [30, 70, 110, 150, 190, 230];

export function DoorsVisual({ doors }: { doors: string[] }) {
  return (
    <div className="hb-v hb-doors">
      <svg viewBox="0 0 540 260" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g className="hb-doors-lines">
          {YS.map((y, i) => (
            <path key={y} d={`M34 130 H140 C 190 130, 200 ${y}, 250 ${y} H340`} pathLength={100} style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </g>
        <circle className="hb-doors-root" cx={34} cy={130} r={11} />
        {YS.map((y, i) => (
          <g key={y}>
            <circle className="hb-doors-ring" cx={354} cy={y} r={11} />
            <circle className="hb-doors-lit" cx={354} cy={y} r={6} style={{ animationDelay: `${0.1 + i * 0.15}s` }} />
            <text className="hb-doors-label" x={376} y={y + 4}>
              {doors[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
