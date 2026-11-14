import { TranslateIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { useTranslations } from "use-intl";
import { RouteLanguageItems } from "@/components/shared/language";

/**
 * Switches the current marketing route between supported Nakafa locales.
 *
 * The compact label treatment keeps the header usable on narrow screens while
 * the footer preserves the full preference label.
 */
export function Language({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Common");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t("language")} variant="outline">
            <HugeIcons icon={TranslateIcon} />
            <span className={cn("truncate", compact && "hidden sm:inline")}>
              {t("language")}
            </span>
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="w-max max-w-[calc(100vw-2rem)]"
        label={t("menu-language")}
      >
        <RouteLanguageItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
