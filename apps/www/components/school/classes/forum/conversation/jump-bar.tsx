import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";

/** Renders the contextual jump actions for back and latest. */
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

    return (
      <div
        className="pointer-events-none absolute right-0 bottom-4 left-0 z-10 flex justify-center"
        style={{ overflowAnchor: "none" }}
      >
        <ButtonGroup className="pointer-events-auto">
          {canGoBack ? (
            <Button onClick={onBack} variant="outline">
              {t("back")}
            </Button>
          ) : null}
          <Button
            aria-label={t("back-to-latest")}
            onClick={onLatest}
            size="icon"
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
