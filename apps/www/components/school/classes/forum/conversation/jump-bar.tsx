import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { memo } from "react";

/** Renders the contextual jump actions for back and latest. */
export const JumpBar = memo(
  ({
    canGoBack,
    onBack,
    onLatest,
    visible,
  }: {
    canGoBack: boolean;
    onBack: () => void;
    onLatest: () => void;
    visible: boolean;
  }) => {
    const t = useTranslations("Common");

    return (
      <div
        className="pointer-events-none absolute right-0 bottom-4 left-0 z-10 flex justify-center"
        style={{ overflowAnchor: "none" }}
      >
        <div
          className={cn(
            "opacity-100 transition-none motion-reduce:transition-none",
            visible
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
        >
          <ButtonGroup>
            {canGoBack ? (
              <Button disabled={!visible} onClick={onBack} variant="outline">
                {t("back")}
              </Button>
            ) : null}
            <Button
              aria-label={t("back-to-latest")}
              disabled={!visible}
              onClick={onLatest}
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={ArrowDown02Icon} />
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }
);
JumpBar.displayName = "JumpBar";
