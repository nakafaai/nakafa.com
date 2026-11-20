import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useTranslations } from "use-intl";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";

/**
 * How to read and drive the player, behind the info button at the start of its pane's footer: what the colors of
 * the numbers mean, then the keys that move, pick and flag, shown, never explained. A mouse opens it by resting on
 * the button, and a press, a touch or the keyboard by choosing it.
 */
export function PlayerAccess() {
  const t = useTranslations("Player");

  return (
    <Popover openOnHover>
      <PopoverTrigger
        render={
          <Button
            className="me-auto"
            size="icon"
            tooltip={t("access")}
            type="button"
            variant="outline"
          />
        }
      >
        <HugeIcons icon={InformationCircleIcon} />
      </PopoverTrigger>
      <PopoverContent className="grid gap-4 text-sm" side="top">
        <p className="font-medium">{t("access")}</p>
        <PlayerLegend />
        <PlayerShortcuts />
      </PopoverContent>
    </Popover>
  );
}
