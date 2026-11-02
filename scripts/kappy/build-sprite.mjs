// Writes lib/kappy/sprite.json from scripts/kappy/sprite.mjs, after checking every grid is rectangular.
// Usage: npm run kappy:sprite

import { writeFileSync } from "node:fs";
import path from "node:path";
import * as S from "./sprite.mjs";

const data = { head: S.HEAD, pupil: S.PUPIL, glint: S.GLINT, body: S.BODY, clawDown: S.CLAW_DOWN, clawUp: S.CLAW_UP, feet: S.FEET, shadow: S.SHADOW, bulbOff: S.BULB_OFF, bulbOn: S.BULB_ON, rays: S.RAYS, rays2: S.RAYS2, cap: S.CAP, briefcase: S.BRIEFCASE, faces: S.FACES };
const grids = [...Object.entries(data).filter(([k]) => k !== "faces"), ...Object.entries(data.faces).map(([k, g]) => [`faces.${k}`, g])];
const ragged = grids.filter(([, g]) => g.some((r) => r.length !== g[0].length)).map(([k]) => k);
const badFaces = Object.entries(data.faces).filter(([, g]) => g.length !== 10 || g[0].length !== 16).map(([k]) => k);
if (ragged.length || badFaces.length) throw new Error(`Not rectangular: ${ragged.join(", ")}; faces not 16 x 10: ${badFaces.join(", ")}`);
const out = path.join(import.meta.dirname, "../../lib/kappy/sprite.json");
writeFileSync(out, JSON.stringify(data) + "\n");
console.log(`Wrote ${path.relative(process.cwd(), out)}: ${grids.length} grids`);
