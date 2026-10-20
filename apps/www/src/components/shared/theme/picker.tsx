import { PaintBoardIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ClientOnly } from "@tanstack/react-router";
import { type ComponentProps, lazy, Suspense, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * Loads the theme list on first intent. It carries one icon for each theme,
 * which no page needs before a visitor reaches for the selector.
 */
const ThemeMenuContent = lazy(() =>
  import("@/components/shared/theme/menu").then((module) => ({
    default: module.ThemeMenuContent,
  }))
);

/** Renders the theme selector. The selected theme lives in the theme store. */
export function ThemePicker({
  variant = "outline",
}: {
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const t = useTranslations("Common");
  const [isRequested, setIsRequested] = useState(false);

  /** Starts loading the list as soon as the visitor reaches for the button. */
  function request() {
    setIsRequested(true);
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          request();
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            onFocus={request}
            onMouseEnter={request}
            onTouchStart={request}
            variant={variant}
          >
            <HugeIcons icon={PaintBoardIcon} />
            <span className="truncate">{t("theme")}</span>
          </Button>
        }
      />

      {isRequested ? (
        <Suspense fallback={null}>
          <ClientOnly fallback={null}>
            <ThemeMenuContent />
          </ClientOnly>
        </Suspense>
      ) : null}
    </DropdownMenu>
  );
}
