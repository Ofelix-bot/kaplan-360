import { cn } from "cn";

/** A section's number, name, headline and lede. The number orders the page's six sections. */
export function SectionHead({
  index,
  eyebrow,
  title,
  lede,
  id,
  tone = "light",
  className,
  children,
}: {
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  id?: string;
  tone?: "light" | "brand";
  className?: string;
  children?: React.ReactNode;
}) {
  const brand = tone === "brand";
  return (
    <div className={cn("flex max-w-3xl flex-col gap-3.5", className)}>
      <p className={cn("flex items-center gap-2.5 text-[0.78rem] font-semibold tracking-[0.12em] uppercase", brand ? "text-white/70" : "text-muted-foreground")}>
        <span className={cn("tabular-nums", brand ? "text-amber" : "text-primary")}>{index}</span>
        <span aria-hidden className={cn("h-px w-6", brand ? "bg-white/30" : "bg-border")} />
        {eyebrow}
      </p>
      <h2 id={id} className="font-heading text-[clamp(1.85rem,3.6vw,2.75rem)] leading-[1.08] font-bold tracking-tight text-balance">
        {title}
      </h2>
      {lede && <p className={cn("max-w-2xl text-base leading-relaxed text-pretty sm:text-lg", brand ? "text-white/75" : "text-muted-foreground")}>{lede}</p>}
      {children}
    </div>
  );
}
