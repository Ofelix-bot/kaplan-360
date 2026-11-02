import { msg } from "@/lib/i18n/translate";
import { CENTRE_ID, RADIAL_BOX, RADIAL_SIZE, roadId, type Layout, type LayoutEdge, type LayoutNode, type Road, type RoadKey, type Tree } from "@/lib/next-steps";

// The map's three groups, formed here at the display layer from the engine's four roads (lib/next-steps
// keeps its RoadKey, which other pages use): Work (the work road), Study (the study road) and Gap (the
// qualifications, then the other roads), in that order. Gap carries the other road's key, so it takes
// that road's colour (--road-other), icon and node id; its leaves keep their ids and contents and are
// re-tagged to it, so the map's chain, colours, timeline and panel read them as Gap's. layoutGroups
// places the three on the radial map as lib/next-steps/layout.ts places the four; the phone tree reads
// the grouped tree as it is.

/** The groups in display order: the key each is drawn with, its name and the engine roads it is made of. */
export const GROUPS: { key: RoadKey; name: string; from: RoadKey[] }[] = [
  { key: "work", name: msg("Work"), from: ["work"] },
  { key: "study", name: msg("Study"), from: ["study"] },
  { key: "other", name: msg("Gap"), from: ["qualify", "other"] },
];

/** The tree with its four roads as the map's three groups. */
export function groupTree(tree: Tree): Tree {
  const roads: Road[] = GROUPS.map((g) => ({
    key: g.key,
    name: { key: g.name },
    leaves: g.from.flatMap((k) => tree.roads.find((r) => r.key === k)?.leaves ?? []).map((l) => (l.road === g.key ? l : { ...l, road: g.key })),
  }));
  return { ...tree, roads };
}

/** Space kept clear inside the box's edge, and between nodes (as in lib/next-steps/layout.ts). */
const MARGIN = 8;
const GAP = 8;

type Slot = { x: number; y: number };

/**
 * The leaf slots of each group, in leaf order: Work up the left column and in the band beside the
 * centre, Study the same on the right, Gap in the two columns' lower rows and the middle under the
 * centre (qualifications first: the left column, then the middle, then the other roads on the right).
 * With six Gap leaves (a fourth qualification), Work's third goes to the middle above the centre and
 * Gap starts in the left band: the four roads' slots, with their roads merged.
 */
function slots(width: number, height: number, gap: number): Partial<Record<RoadKey, Slot[]>> {
  const { leaf } = RADIAL_SIZE;
  const left = MARGIN;
  const right = width - MARGIN - leaf.width;
  const middle = width / 2 - leaf.width / 2;
  const top = [MARGIN, MARGIN + leaf.height + GAP];
  const bottom = [height - MARGIN - leaf.height, height - MARGIN - 2 * leaf.height - GAP];
  const band = height / 2 - leaf.height / 2;
  const six = gap > 5;
  return {
    work: [{ x: left, y: top[0] }, { x: left, y: top[1] }, six ? { x: middle, y: top[0] } : { x: left, y: band }],
    study: [{ x: right, y: top[0] }, { x: right, y: top[1] }, { x: right, y: band }],
    other: [
      ...(six ? [{ x: left, y: band }] : []),
      { x: left, y: bottom[1] },
      { x: left, y: bottom[0] },
      { x: middle, y: bottom[0] },
      { x: right, y: bottom[1] },
      { x: right, y: bottom[0] },
    ],
  };
}

const edgesOf = (tree: Tree): LayoutEdge[] =>
  tree.roads.flatMap((r) => [
    { id: `${CENTRE_ID}>${roadId(r.key)}`, from: CENTRE_ID, to: roadId(r.key), road: r.key },
    ...r.leaves.map((l) => ({ id: `${roadId(r.key)}>${l.id}`, from: roadId(r.key), to: l.id, road: r.key })),
  ]);

/**
 * The radial map of a grouped tree (groupTree) in the engine's box and node sizes: the centre in the
 * middle; Work's and Study's roads above it, either side of its middle, and Gap's under it, each 8 px
 * clear of the centre. Throws when a group has more leaves than its slots.
 */
export function layoutGroups(tree: Tree, box: { width: number; height: number } = RADIAL_BOX): Layout {
  const { centre, road, leaf } = RADIAL_SIZE;
  const cx = box.width / 2;
  const cy = box.height / 2;
  const nodes: LayoutNode[] = [{ id: CENTRE_ID, kind: "centre", x: cx - centre.width / 2, y: cy - centre.height / 2, width: centre.width, height: centre.height, layer: 0 }];
  const above = cy - centre.height / 2 - GAP - road.height;
  const below = cy + centre.height / 2 + GAP;
  const roadAt: Partial<Record<RoadKey, Slot>> = {
    work: { x: cx - GAP - road.width, y: above },
    study: { x: cx + GAP, y: above },
    other: { x: cx - road.width / 2, y: below },
  };
  const leafSlots = slots(box.width, box.height, tree.roads.find((r) => r.key === "other")?.leaves.length ?? 0);
  for (const r of tree.roads) {
    const at = roadAt[r.key];
    const free = leafSlots[r.key] ?? [];
    if (!at) throw new Error(`layoutGroups: ${r.key} is not one of the map's groups`);
    if (r.leaves.length > free.length) throw new Error(`layoutGroups: ${r.key} has ${r.leaves.length} leaves and ${free.length} slots`);
    nodes.push({ id: roadId(r.key), kind: "road", road: r.key, ...at, width: road.width, height: road.height, layer: 1 });
    r.leaves.forEach((l, i) => nodes.push({ id: l.id, kind: "leaf", road: r.key, ...free[i], width: leaf.width, height: leaf.height, layer: 2 }));
  }
  return { width: box.width, height: box.height, nodes, edges: edgesOf(tree) };
}
