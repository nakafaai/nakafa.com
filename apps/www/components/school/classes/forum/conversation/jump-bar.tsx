"use client";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";

/** Renders the contextual jump actions for going back or returning to latest. */
export const JumpBar = memo(
  ({
    canGoBack,
    onBack,
    onLatest,
  }: {
    canGoBack: boolean;
    onBack: () => void;
    onLatest: () => void;
  }) => {
    const t = useTranslations("Common");

    if (!canGoBack) {
      return null;
    }

    return (
      <div className="absolute right-0 bottom-4 left-0 z-10 flex justify-center">
        <ButtonGroup>
          <Button onClick={onBack} size="sm" variant="outline">
            {t("back")}
          </Button>
          <Button
            aria-label={t("back-to-latest")}
            onClick={onLatest}
            size="icon-sm"
            variant="outline"
          >
            <HugeIcons icon={ArrowDown02Icon} />
          </Button>
        </ButtonGroup>
      </div>
    );
  }
);
JumpBar.displayName = "JumpBar";
