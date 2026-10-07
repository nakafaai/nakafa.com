"use client";

import { PaintBoardIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";
import { Language } from "@/components/marketing/shared/language";

/** Renders footer preference actions that share the same language route resolver as the sidebar. */
export function FooterAction() {
  return (
    <ButtonGroup>
      <Language />
      <Theme />
    </ButtonGroup>
  );
}

/**
 * Loads the theme list on first intent. It carries one icon for each theme,
 * which no page needs before a visitor reaches for the selector.
 */
const ThemeMenuContent = dynamic(
  () =>
    import("@/components/marketing/shared/footer/theme").then(
      (module) => module.ThemeMenuContent
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

/** Renders the footer theme selector while leaving the selected theme in next-themes. */
export function Theme({
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

      {isRequested ? <ThemeMenuContent /> : null}
    </DropdownMenu>
  );
}
