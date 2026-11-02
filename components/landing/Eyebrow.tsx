import { cn } from "cn";

// The step label above each landing section's title ("01", "02", "03" on /move; "01 · Look" where a label
// is given), so the three steps read as one route down the page. Plain text, no motion: it reads the same
// with JS off. tone "night" is for sections on the indigo ground.

export function Eyebrow({ step, label, tone = "tint", className, stepClassName }: { step: string; label?: string; tone?: "tint" | "night"; className?: string; stepClassName?: string }) {
  const night = tone === "night";
  return (
    <p className={cn("text-[13px] font-medium tracking-[0.02em] sm:text-sm", night ? "text-(--land-night-muted)" : "text-muted-foreground", className)}>
      <span className={cn("font-semibold tabular-nums", stepClassName)}>{step}</span>
      {label && <> · {label}</>}
    </p>
  );
}
