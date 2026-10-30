import { useTranslations } from "use-intl";
import { PlayerFlagMark } from "@/components/player/navigator/grid";

/**
 * Names the three marks of the numbers, each beside a small swatch drawn the
 * way the grid draws it: filled when answered, outlined in the destructive
 * color when unanswered, and
 * the flag mark when flagged.
 */
export function PlayerLegend() {
  const t = useTranslations("Player");

  return (
    <ul className="grid gap-2 text-muted-foreground text-xs">
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-sm bg-primary"
        />
        {t("legend-answered")}
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-sm border border-destructive bg-destructive/5"
        />
        {t("unanswered")}
      </li>
      <li className="flex items-center gap-2">
        <PlayerFlagMark placement="inline" />
        {t("legend-flagged")}
      </li>
    </ul>
  );
}
