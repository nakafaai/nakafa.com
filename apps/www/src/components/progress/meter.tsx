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
 * primary colour belongs to the page's primary button.
 */
export function LevelMeter({
  className,
  named = false,
}: {
  className?: string;
  /** Whether the level stands before the bar, where no title beside it says it already. */
  named?: boolean;
}) {
  const t = useTranslations("Island");
  const { island } = useProgress();
  const { left, share } = levelProgress(island);
  const text = t("left", { stars: left });
  const fill: CSSProperties = { "--share": share };
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
        className="bg-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
        role="progressbar"
      >
        <span
          className="bg-pop-yellow h-full w-[calc(var(--share)*100%)] rounded-full transition-[width] duration-500 ease-out"
          style={fill}
        />
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {text}
      </span>
    </span>
  );
}
