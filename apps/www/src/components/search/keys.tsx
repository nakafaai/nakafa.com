import {
  ArrowDown02Icon,
  ArrowMoveDownLeftIcon,
  ArrowUp02Icon,
} from "@hugeicons/core-free-icons";
import { CommandFooter } from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Kbd, KbdGroup } from "@repo/design-system/components/ui/kbd";
import { useTranslations } from "use-intl";

/**
 * The foot of a command palette: the keys that move through it, open a row and
 * close it. A touch screen has none of these keys, so it draws no foot.
 */
export function CommandKeys() {
  const t = useTranslations("Common");

  return (
    <CommandFooter className="pointer-coarse:hidden">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <KbdGroup>
            <Kbd>
              <HugeIcons icon={ArrowUp02Icon} />
            </Kbd>
            <Kbd>
              <HugeIcons icon={ArrowDown02Icon} />
            </Kbd>
          </KbdGroup>
          <span>{t("navigate")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Kbd>
            <HugeIcons icon={ArrowMoveDownLeftIcon} />
          </Kbd>
          <span>{t("open")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Kbd>Esc</Kbd>
        <span>{t("close")}</span>
      </div>
    </CommandFooter>
  );
}
