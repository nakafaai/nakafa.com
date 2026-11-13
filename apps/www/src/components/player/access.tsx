import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useTranslations } from "use-intl";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";

/**
 * How the player works without a mouse, behind the info button at the start of its pane's footer: one sentence on
 * what a screen reader hears, then the keys that move, pick and flag. A mouse opens it by resting on the button, and
 * a press, a touch or the keyboard by choosing it.
 */
export function PlayerAccess() {
  const t = useTranslations("Player");

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
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
      <PopoverContent className="grid gap-3 text-sm" side="top">
        <p className="font-medium">{t("access")}</p>
        <p className="text-muted-foreground">{t("access-description")}</p>
        <PlayerShortcuts />
      </PopoverContent>
    </Popover>
  );
}
