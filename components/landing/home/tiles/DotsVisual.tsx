// Tile 5: a field of dots with an amber band sweeping across it. Decorative: the dots stand for no
// proportion. The band and its dots move in opposite directions (transforms only), so the amber dots
// stay on the grid. 5s loop.

export function DotsVisual() {
  return (
    <div className="hb-v hb-dots">
      <div className="hb-dots-field">
        <span className="hb-dots-band">
          <span className="hb-dots-amber" />
        </span>
      </div>
    </div>
  );
}
