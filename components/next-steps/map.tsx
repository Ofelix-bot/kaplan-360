"use client";

import { memo, useMemo } from "react";
import { Handle, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { CENTRE_ID, RADIAL_BOX, RADIAL_SIZE, type Layout, type RoadKey, type Tree } from "@/lib/next-steps";
import { edgePaths, outward } from "./edges";
import { layoutGroups } from "./groups";
import { Appear, CentreCard, ENTER_SHIFT, enterTransition, LeafCard, RoadCard, useDimmed, useMap, DIM, type CentreView } from "./nodes";

// The radial mind map (800 px and wider): layoutGroups (./groups.ts) places the three groups' nodes in
// the engine's fixed 760 × 640 box and React Flow only draws them. Nothing drags, pans, zooms or connects; the page
// scrolls over it as over any picture; the view is fitted once, at mount, at 100%. Edges are our own
// béziers (./edges.ts) in the road's colour, drawn in with the nodes' layers.

type NodeData = { kind: "centre" | "road" | "leaf"; layer: 0 | 1 | 2; shift: { x: number; y: number }; road?: RoadKey; centre?: CentreView };
type EdgeData = { d: string; road: RoadKey; layer: 1 | 2 };
type MapNode = Node<NodeData>;
type MapEdge = Edge<EdgeData>;

/** Invisible handles: React Flow needs one at each end of an edge; the path itself comes from ./edges.ts. */
function Ends() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className="pointer-events-none opacity-0" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="pointer-events-none opacity-0" />
    </>
  );
}

const MapNodeView = memo(function MapNodeView({ id, data }: NodeProps<MapNode>) {
  const m = useMap();
  const road = data.road ? m.tree.roads.find((r) => r.key === data.road) : undefined;
  const leaf = road?.leaves.find((l) => l.id === id);
  return (
    <>
      <Ends />
      {/* React Flow gives a node with no handlers of its own pointer-events: none; the buttons inside take clicks. */}
      <Appear id={id} layer={data.layer} shift={data.shift} className="pointer-events-auto">
        {data.kind === "centre" && data.centre && <CentreCard view={data.centre} />}
        {data.kind === "road" && road && <RoadCard road={road} />}
        {data.kind === "leaf" && leaf && <LeafCard leaf={leaf} />}
      </Appear>
    </>
  );
});

const RoadEdge = memo(function RoadEdge({ id, data }: EdgeProps<MapEdge>) {
  const m = useMap();
  const dim = useDimmed(id);
  if (!data) return null;
  return (
    <motion.path
      key={m.reduce ? "still" : "moving"}
      d={data.d}
      fill="none"
      stroke={`var(--road-${data.road})`}
      strokeWidth={2}
      strokeLinecap="round"
      initial={m.reduce || m.played ? false : { pathLength: 0 }}
      animate={{ pathLength: 1, opacity: dim ? DIM : 1 }}
      transition={enterTransition(data.layer, m.played, m.reduce)}
    />
  );
});

const nodeTypes = { map: MapNodeView };
const edgeTypes = { road: RoadEdge };

/** React Flow's nodes and edges for a layout. */
export function flowOf(layout: Layout, centre: CentreView): { nodes: MapNode[]; edges: MapEdge[] } {
  const paths = edgePaths(layout);
  const out = outward(layout);
  const layerOf = new Map(layout.nodes.map((n) => [n.id, n.layer]));
  const nodes: MapNode[] = layout.nodes.map((n) => ({
    id: n.id,
    type: "map",
    position: { x: n.x, y: n.y },
    width: n.width,
    height: n.height,
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    data: { kind: n.kind, layer: n.layer, road: n.road, shift: { x: (out[n.id]?.x ?? 0) * ENTER_SHIFT, y: (out[n.id]?.y ?? 0) * ENTER_SHIFT }, centre: n.id === CENTRE_ID ? centre : undefined },
  }));
  const edges: MapEdge[] = layout.edges.map((e) => ({ id: e.id, source: e.from, target: e.to, type: "road", focusable: false, selectable: false, data: { d: paths[e.id], road: e.road, layer: layerOf.get(e.to) === 1 ? 1 : 2 } }));
  return { nodes, edges };
}

/** `tree`: the grouped tree (groupTree). */
export function RadialMap({ tree, centre, onPaneClick }: { tree: Tree; centre: CentreView; onPaneClick: () => void }) {
  const t = useT();
  const { nodes, edges } = useMemo(() => flowOf(layoutGroups(tree), centre), [tree, centre]);
  return (
    <div role="group" aria-label={t("Map of your roads")} className="relative" style={{ width: RADIAL_BOX.width, height: RADIAL_BOX.height }}>
      <ReactFlow<MapNode, MapEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        panActivationKeyCode={null}
        zoomActivationKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        deleteKeyCode={null}
        disableKeyboardA11y
        autoPanOnNodeFocus={false}
        minZoom={1}
        maxZoom={1}
        fitView
        fitViewOptions={{ padding: "8px", minZoom: 1, maxZoom: 1 }}
        onPaneClick={onPaneClick}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      />
    </div>
  );
}

/** The centre alone in the map's box, where React Flow will put it: shown while the scores load. */
export function RadialWaiting({ centre }: { centre: CentreView }) {
  const t = useT();
  const box = RADIAL_BOX;
  const size = RADIAL_SIZE.centre;
  return (
    <div aria-busy="true" className="relative" style={{ width: box.width, height: box.height }}>
      <p role="status" className="sr-only">
        {t("Loading programmes")}
      </p>
      <div className="absolute" style={{ left: box.width / 2 - size.width / 2, top: box.height / 2 - size.height / 2, width: size.width, height: size.height }}>
        <CentreCard view={centre} />
      </div>
    </div>
  );
}

