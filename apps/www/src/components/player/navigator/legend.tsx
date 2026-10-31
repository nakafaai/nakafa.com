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
    <ul className="text-muted-foreground grid gap-2 text-xs">
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-primary size-4 shrink-0 rounded-sm"
        />
        {t("legend-answered")}
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="border-destructive bg-destructive/5 size-4 shrink-0 rounded-sm border"
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
