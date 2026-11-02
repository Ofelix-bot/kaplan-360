"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether the element is on screen (with an 80px margin), so a scene's loop runs only while it can be seen.
 * False on the server and before the observer's first call: the static frame is complete on its own.
 */
export function useOnScreen<T extends Element>(rootMargin = "80px") {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, on] as const;
}
