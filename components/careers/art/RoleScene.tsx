"use client";

import { cn } from "cn";
import { roleSceneId, SCENE_TINT } from "@/lib/careers/art";
import { SCENES } from "./scenes";
import { useOnScreen } from "./useOnScreen";

// A role's flat picture (plan §C): its scene (one of 57, shared by similar roles; lib/careers/art.ts) on the
// scene's tinted panel, 132px tall and the full width it's given. The scene's code loads only when a card shows
// it. The loop runs only while the panel is on screen (.rs-on); with reduced motion or the site's pause it is the
// static frame (careers.css, "Role scenes"). Decorative: the card's title names the role.

export function RoleScene({ roleId, className }: { roleId: string; className?: string }) {
  const [ref, on] = useOnScreen<HTMLDivElement>();
  const id = roleSceneId(roleId);
  const Scene = id ? SCENES[id] : undefined;
  if (!id || !Scene) return null;
  return (
    <div ref={ref} aria-hidden="true" className={cn("rs-scene", `rs-p-${SCENE_TINT[id]}`, on && "rs-on", className)}>
      <Scene />
    </div>
  );
}
