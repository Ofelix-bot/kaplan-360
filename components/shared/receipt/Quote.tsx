"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReceiptView } from "@/lib/receipts/model";
import { langOf } from "./text";

/** A quote with the words that matter highlighted. */
export function Quote({ text, mark = [], className }: { text: string; mark?: string[]; className?: string }) {
  const parts = useMemo(() => {
    if (!mark.length) return [{ text, marked: false }];
    const re = new RegExp(`(${mark.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
    return text
      .split(re)
      .filter(Boolean)
      .map((p) => ({ text: p, marked: mark.includes(p) }));
  }, [text, mark]);
  return (
    <span className={className} lang={langOf(text)}>
      “
      {parts.map((p, i) =>
        p.marked ? (
          <mark key={i} className="rounded-[3px] bg-amber/55 px-0.5 text-inherit dark:bg-amber/35">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
      ”
    </span>
  );
}

/** A page photo that shows a placeholder of its own shape until it has loaded. */
export function ShotFrame({ shot, sizes, className, priority = false }: { shot: NonNullable<ReceiptView["shot"]>; sizes: string; className?: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} style={{ aspectRatio: `${shot.width} / ${shot.height}` }}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <Image
        src={shot.src}
        alt=""
        width={shot.width}
        height={shot.height}
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={cn("h-full w-full object-cover object-top transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
