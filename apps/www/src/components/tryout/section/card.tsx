import type { ReactNode } from "react";

/** Renders the production summary card used by try-out section pages. */
export function TryoutPartSummary({ children }: { children: ReactNode }) {
  return (
    <section className="bg-card space-y-4 rounded-xl border p-5 shadow-sm [--number-flow-mask-height:0.125em]">
      {children}
    </section>
  );
}

/**
 * Lays out the summary metrics: stacked on a phone, then two side by side. A
 * row of three, such as a score beside its time limit, stays stacked until
 * the card is wide enough for all three, where the last one takes the width
 * of its digits and the first two share the rest. While `waiting` a signed-in
 * learner sees them hold their room (`globals.css`), so a score never replaces
 * another value.
 */
export function TryoutPartStats({
  children,
  waiting = false,
}: {
  children: ReactNode;
  /** The learner read that decides these metrics has not answered yet. */
  waiting?: boolean;
}) {
  return (
    <div
      className="grid w-full gap-6 sm:grid-cols-2 sm:has-[>:nth-child(3)]:grid-cols-1 md:has-[>:nth-child(3)]:grid-cols-[1fr_1fr_auto]"
      data-learner-read={waiting ? "pending" : undefined}
    >
      {children}
    </div>
  );
}

/** Renders one labeled summary metric. */
export function TryoutPartStat({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
