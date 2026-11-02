// Types for ./scene.js, the Wilkie Edge pixel scene.

export type CampusScene = {
  /** Holds the current frame (true) or lets the scene run on (false). */
  setPaused(paused: boolean): void;
  /** Stops drawing and lets go of the canvas. */
  destroy(): void;
};

/** Draws the scene into `canvas`, sized to the canvas's box; `fps` caps the drawing (default 20). */
export function mountCampus(canvas: HTMLCanvasElement, opts: { paused: boolean; fps?: number }): CampusScene;
