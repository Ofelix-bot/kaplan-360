import { cn } from "cn";
import ProfileHead from "@/components/careers/art/heads/profile";

// /profile's head illustration: a student at a desk ticking a profile form, the amber pencil its one accent.
// Drawn with the careers industry heads (scripts/careers/build-art.mjs generates it from parts/head-profile.html),
// so it shares their .la line-art classes in app/globals.css and follows dark mode. Decorative (aria-hidden).

export function ProfileArt({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("[&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)}>
      <ProfileHead />
    </div>
  );
}
