import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PlayerFlagMark } from "@/components/player/navigator/grid";
import { usePlayer } from "@/components/player/provider";

/** A swatch drawn the way the navigator draws a number in that state. */
const swatchVariants = cva("size-4 shrink-0 rounded-sm", {
  variants: {
    look: {
      answered: "bg-primary",
      correct: "border-success bg-success/5 border",
      incorrect: "border-destructive bg-destructive/5 border",
      missing: "border-destructive bg-destructive/5 border",
      unanswered: "border-muted-foreground border border-dashed",
    },
  },
});

/**
 * Names the marks of the navigator's numbers, each beside a swatch drawn as the number is. A running paper's
 * numbers are filled once answered, outlined in the destructive color while unanswered, and carry the flag
 * mark once flagged; a finished paper's are green when right, red when wrong, and dashed when unanswered.
 */
export function PlayerLegend() {
  const t = useTranslations("Player");
  const review = usePlayer((state) => state.review);

  return (
    <ul className="text-muted-foreground grid gap-2 text-xs">
      {review ? (
        <>
          <LegendItem mark={<Swatch look="correct" />}>
            {t("correct")}
          </LegendItem>
          <LegendItem mark={<Swatch look="incorrect" />}>
            {t("incorrect")}
          </LegendItem>
          <LegendItem mark={<Swatch look="unanswered" />}>
            {t("unanswered")}
          </LegendItem>
        </>
      ) : (
        <>
          <LegendItem mark={<Swatch look="answered" />}>
            {t("legend-answered")}
          </LegendItem>
          <LegendItem mark={<Swatch look="missing" />}>
            {t("unanswered")}
          </LegendItem>
          <LegendItem mark={<PlayerFlagMark placement="inline" />}>
            {t("legend-flagged")}
          </LegendItem>
        </>
      )}
    </ul>
  );
}

/** One mark of the legend and what it says. */
function LegendItem({
  children,
  mark,
}: {
  children: ReactNode;
  mark: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      {mark}
      {children}
    </li>
  );
}

/** One swatch of the legend. */
function Swatch({
  look,
}: {
  look: "answered" | "correct" | "incorrect" | "missing" | "unanswered";
}) {
  return <span aria-hidden="true" className={swatchVariants({ look })} />;
}
