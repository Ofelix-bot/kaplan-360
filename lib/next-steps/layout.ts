// Where the map's nodes go, worked out by hand rather than by a graph library: pure and deterministic,
// so scripts/check-next-steps.ts can prove that nothing overlaps and everything stays inside its box.
// - layoutRadial (800 px and wider): the centre in the middle, the roads on the diagonals around it
//   (study top-left, work top-right, qualifications bottom-left, other roads bottom-right), each road's
//   leaves fanned outward in its quadrant: two up the outer column, the third beside the centre (study,
//   work) or under it (qualifications). With a fourth qualification (an Australian or Irish degree's
//   accountancy body), study's third leaf moves above the centre and qualifications take the band beside it.
// - layoutColumn (phones): the centre on top, the roads down a left rail, each road's leaves indented
//   under it, one column.

import { CENTRE_ID, roadId, type Layout, type LayoutEdge, type LayoutNode, type RoadKey, type Tree } from "./types";

/** Node sizes on the radial map. */
export const RADIAL_SIZE = { centre: { width: 280, height: 96 }, road: { width: 176, height: 64 }, leaf: { width: 200, height: 88 } } as const;
/** The radial map's box. */
export const RADIAL_BOX = { width: 760, height: 640 } as const;
/** Space kept clear inside the box's edge, and between nodes. */
const MARGIN = 8;
const GAP = 8;

type Slot = { x: number; y: number };

/**
 * The leaf slots of each road, in leaf order, for a box of width × height: the outer column's two rows
 * at the top (or bottom), then the band beside the centre (study, work) or the middle under the centre
 * (qualifications). Other roads have two leaves and use the outer column only. With `qualify` leaves
 * at four, study's third goes to the middle above the centre and qualifications start in the left band
 * (band, then the outer column's two rows, then the middle under the centre): read top to bottom, then
 * left to right, as with three.
 */
function slots(width: number, height: number, qualify: number): Record<RoadKey, Slot[]> {
  const { leaf } = RADIAL_SIZE;
  const left = MARGIN;
  const right = width - MARGIN - leaf.width;
  const middle = width / 2 - leaf.width / 2;
  const top = [MARGIN, MARGIN + leaf.height + GAP];
  const bottom = [height - MARGIN - leaf.height, height - MARGIN - 2 * leaf.height - GAP];
  const band = height / 2 - leaf.height / 2;
  const four = qualify > 3;
  return {
    study: [{ x: left, y: top[0] }, { x: left, y: top[1] }, four ? { x: middle, y: top[0] } : { x: left, y: band }],
    work: [{ x: right, y: top[0] }, { x: right, y: top[1] }, { x: right, y: band }],
    qualify: [...(four ? [{ x: left, y: band }] : []), { x: left, y: bottom[1] }, { x: left, y: bottom[0] }, { x: middle, y: bottom[0] }],
    other: [{ x: right, y: bottom[1] }, { x: right, y: bottom[0] }],
  };
}

const edgesOf = (tree: Tree): LayoutEdge[] =>
  tree.roads.flatMap((r) => [
    { id: `${CENTRE_ID}>${roadId(r.key)}`, from: CENTRE_ID, to: roadId(r.key), road: r.key },
    ...r.leaves.map((l) => ({ id: `${roadId(r.key)}>${l.id}`, from: roadId(r.key), to: l.id, road: r.key })),
  ]);

/**
 * The radial map in a box (760 × 640 is the design size; smaller boxes are not checked). Centre
 * 280 × 96 in the middle; roads 176 × 64 just off the centre's corners, 8 px from it; leaves 200 × 88
 * in their quadrant's slots (three or four for qualifications). Throws when a road has more leaves than
 * its quadrant has slots.
 */
export function layoutRadial(tree: Tree, box: { width: number; height: number } = RADIAL_BOX): Layout {
  const { centre, road, leaf } = RADIAL_SIZE;
  const cx = box.width / 2;
  const cy = box.height / 2;
  const nodes: LayoutNode[] = [{ id: CENTRE_ID, kind: "centre", x: cx - centre.width / 2, y: cy - centre.height / 2, width: centre.width, height: centre.height, layer: 0 }];
  // The roads sit above and below the centre, either side of its middle, 8 px clear of it and of each other.
  const above = cy - centre.height / 2 - GAP - road.height;
  const below = cy + centre.height / 2 + GAP;
  const roadAt: Record<RoadKey, Slot> = {
    study: { x: cx - GAP - road.width, y: above },
    work: { x: cx + GAP, y: above },
    qualify: { x: cx - GAP - road.width, y: below },
    other: { x: cx + GAP, y: below },
  };
  const leafSlots = slots(box.width, box.height, tree.roads.find((r) => r.key === "qualify")?.leaves.length ?? 0);
  for (const r of tree.roads) {
    nodes.push({ id: roadId(r.key), kind: "road", road: r.key, ...roadAt[r.key], width: road.width, height: road.height, layer: 1 });
    const free = leafSlots[r.key];
    if (r.leaves.length > free.length) throw new Error(`layoutRadial: ${r.key} has ${r.leaves.length} leaves and ${free.length} slots`);
    r.leaves.forEach((l, i) => nodes.push({ id: l.id, kind: "leaf", road: r.key, ...free[i], width: leaf.width, height: leaf.height, layer: 2 }));
  }
  return { width: box.width, height: box.height, nodes, edges: edgesOf(tree) };
}

/** Node heights and indents on the phone column. */
export const COLUMN_SIZE = { centre: 96, road: 56, leaf: 80, gap: 12, roadGap: 20, rail: 12, roadIndent: 24, leafIndent: 48 } as const;

/**
 * The phone column, `width` wide (the page's content width): the centre on top at full width; then each
 * road, indented from the left rail, and its leaves indented under it, one after another. Returns the
 * total height as Layout.height.
 */
export function layoutColumn(tree: Tree, box: { width: number }): Layout {
  const s = COLUMN_SIZE;
  const nodes: LayoutNode[] = [{ id: CENTRE_ID, kind: "centre", x: 0, y: 0, width: box.width, height: s.centre, layer: 0 }];
  let y = s.centre + s.roadGap;
  for (const r of tree.roads) {
    nodes.push({ id: roadId(r.key), kind: "road", road: r.key, x: s.roadIndent, y, width: box.width - s.roadIndent, height: s.road, layer: 1 });
    y += s.road + s.gap;
    for (const l of r.leaves) {
      nodes.push({ id: l.id, kind: "leaf", road: r.key, x: s.leafIndent, y, width: box.width - s.leafIndent, height: s.leaf, layer: 2 });
      y += s.leaf + s.gap;
    }
    y += s.roadGap - s.gap;
  }
  return { width: box.width, height: y - s.roadGap, nodes, edges: edgesOf(tree) };
}

/** The x of the phone column's rail, for the page to draw it. */
export const COLUMN_RAIL_X = COLUMN_SIZE.rail;
