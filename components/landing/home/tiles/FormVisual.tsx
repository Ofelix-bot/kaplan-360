// Tile 6: a browser window with the Start planning form and a lock; only "1 sentence" travels to
// Claude and back, then is gone. 5.2s loop.

export function FormVisual({ sentence }: { sentence: string }) {
  return (
    <div className="hb-v hb-form">
      <svg viewBox="0 0 320 170" focusable="false">
        <rect className="hb-form-win" x={10} y={8} width={190} height={154} rx={10} />
        <path className="hb-form-bar" d="M20 8 H190 A10 10 0 0 1 200 18 V32 H10 V18 A10 10 0 0 1 20 8 Z" />
        {[26, 40, 54].map((cx) => (
          <circle key={cx} className="hb-form-dot" cx={cx} cy={20} r={4} />
        ))}
        <rect className="hb-form-label" x={26} y={48} width={70} height={7} rx={3.5} />
        <rect className="hb-form-field" x={26} y={62} width={158} height={18} rx={5} />
        <rect className="hb-form-label" x={26} y={90} width={70} height={7} rx={3.5} />
        <rect className="hb-form-field" x={26} y={104} width={158} height={18} rx={5} />
        <rect className="hb-form-fill" x={30} y={66} width={96} height={10} rx={5} />
        <rect className="hb-form-fill" x={30} y={108} width={72} height={10} rx={5} />
        <path className="hb-form-shackle" d="M164 128 h22 v-8 a11 11 0 0 0 -22 0 z" />
        <rect className="hb-form-lock" x={160} y={128} width={30} height={22} rx={4} />
        <circle className="hb-form-claude" cx={268} cy={80} r={28} />
        <text className="hb-form-claude-name" x={268} y={84} textAnchor="middle">
          Claude
        </text>
        <g className="hb-form-trip">
          <rect x={104} y={136} width={110} height={24} rx={12} />
          <text x={159} y={152} textAnchor="middle">
            {sentence}
          </text>
        </g>
      </svg>
    </div>
  );
}
