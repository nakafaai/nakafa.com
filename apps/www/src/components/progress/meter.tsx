import { cn } from "cn";
import type { CSSProperties } from "react";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { levelProgress } from "@/components/progress/level";

/**
 * The learner's way to the next level of their island, as a game draws it: a
 * bar filled as far as their Stars reach, and beside it the Stars still to
 * earn. Every lesson and every try-out adds Stars, so this one bar is what
 * all learning on Nakafa moves. It fills in the Stars' own yellow: the
 * primary colour belongs to the page's primary button. A page that offers
 * Stars, such as a try-out set, draws the share it still gives after the
 * fill in a lighter yellow, so a learner sees what it does before starting.
 */
export function LevelMeter({
  className,
  gain = 0,
  named = false,
}: {
  className?: string;
  /** The Stars the page still gives, drawn after the fill up to the next level. */
  gain?: number;
  /** Whether the level stands before the bar, where no title beside it says it already. */
  named?: boolean;
}) {
  const t = useTranslations("Island");
  const { island } = useProgress();
  const { left, share } = levelProgress(island);
  const text = t("left", { stars: left });
  const fill: CSSProperties = {
    "--ahead": Math.min(gain, left) / (island.next - island.from),
    "--share": share,
  };
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      {named ? (
        <span className="shrink-0 text-xs font-medium tabular-nums">
          {t("level", { level: island.level })}
        </span>
      ) : null}
      <span
        aria-label={t("level", { level: island.level })}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(share * 100)}
        aria-valuetext={text}
        className="bg-muted relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
        role="progressbar"
        style={fill}
      >
        <span className="bg-pop-yellow absolute inset-y-0 start-0 w-[calc(var(--share)*100%)] rounded-full transition-[width] duration-500 ease-out" />
        {gain > 0 ? (
          <span className="bg-pop-yellow/35 absolute inset-y-0 start-[calc(var(--share)*100%)] w-[calc(var(--ahead)*100%)] rounded-e-full transition-[inset-inline-start,width] duration-500 ease-out" />
        ) : null}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {text}
      </span>
    </span>
  );
}
