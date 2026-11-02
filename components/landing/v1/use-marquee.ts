"use client";

import { useRef, useState } from "react";

/**
 * Box selection over a set of items: press on an empty spot of the area and drag, and every item
 * the box touches is selected (with Shift, Ctrl or ⌘ held, added to the selection). Items carry
 * `data-select-id`. Mouse only; a press that doesn't move clears the selection.
 */
export function useMarquee({ selected, onSelect }: { selected: string[]; onSelect: (ids: string[]) => void }) {
  const area = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; base: string[]; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !area.current) return;
    // React passes events from portals (menus, dialogs, previews opened from a card) up its own tree:
    // only a press on the area itself starts a box.
    if (!area.current.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("[data-select-id],a,button,input,textarea,select,label,[role=button],[role=radio],[role=slider],[data-no-marquee]")) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    drag.current = { x: e.clientX, y: e.clientY, base: additive ? selected : [], moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !area.current) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    d.moved = true;
    const left = Math.min(d.x, e.clientX);
    const top = Math.min(d.y, e.clientY);
    const right = Math.max(d.x, e.clientX);
    const bottom = Math.max(d.y, e.clientY);
    const a = area.current.getBoundingClientRect();
    setBox({ x: left - a.left, y: top - a.top, w: right - left, h: bottom - top });
    const hits: string[] = [];
    for (const el of area.current.querySelectorAll<HTMLElement>("[data-select-id]")) {
      const r = el.getBoundingClientRect();
      if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) hits.push(el.dataset.selectId!);
    }
    onSelect([...new Set([...d.base, ...hits])]);
  };

  const end = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && !d.base.length) onSelect([]);
    drag.current = null;
    setBox(null);
    document.body.style.userSelect = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return { area, box, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end } };
}
