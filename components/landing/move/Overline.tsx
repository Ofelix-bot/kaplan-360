import { cn } from "cn";

// The English /move page's small capitals over a heading or a list ("How it works", "Why", "Sources",
// "Kaplan 360++ checks"): letter-spaced, in the body colour.

export function Overline({ as: Tag = "p", id, className, children }: { as?: "p" | "h2" | "h3" | "h4"; id?: string; className?: string; children: React.ReactNode }) {
  return (
    <Tag id={id} className={cn("m-0 font-sans text-[13px] leading-5 font-semibold tracking-[0.12em] text-(--land-body) uppercase [font-stretch:100%]", className)}>
      {children}
    </Tag>
  );
}
