import type { ReactNode } from "react";
import { KEPT_NAME_SCRIPT } from "@/components/tryout/set/kept";

/**
 * Renders the production summary card used by try-out section pages. While `waiting` under a signed-in
 * hint a page this browser last read as finished keeps its card from the first frame (`globals.css`),
 * because the read will put two panes there, never a card.
 */
export function TryoutPartSummary({
  children,
  waiting,
}: {
  children: ReactNode;
  /** The learner read that decides the page has not answered yet. */
  waiting: boolean;
}) {
  return (
    <section
      className="bg-card space-y-4 rounded-xl border p-5 shadow-sm [--number-flow-mask-height:0.125em]"
      data-summary-read={waiting ? "pending" : undefined}
    >
      {waiting ? (
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only
          dangerouslySetInnerHTML={{ __html: KEPT_NAME_SCRIPT }}
          suppressHydrationWarning
        />
      ) : null}
      {children}
    </section>
  );
}

/**
 * Lays out the summary metrics by the room they have, on a page or in a pane:
 * stacked, then two side by side. A row of three, such as a score beside its
 * time limit, stays stacked until there is room for all three, where the last one takes the width
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
    <div className="@container w-full">
      <div
        className="grid w-full gap-6 @lg:grid-cols-2 @lg:has-[>:nth-child(3)]:grid-cols-1 @2xl:has-[>:nth-child(3)]:grid-cols-[1fr_1fr_auto]"
        data-learner-read={waiting ? "pending" : undefined}
      >
        {children}
      </div>
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
