import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

/** Renders the contextual jump actions for back and latest. */
export function JumpBar({
  canGoBack,
  onBack,
  onLatest,
  showLatest,
}: {
  canGoBack: boolean;
  onBack: () => void;
  onLatest: () => void;
  showLatest: boolean;
}) {
  const t = useTranslations("Common");
  const visible = canGoBack || showLatest;

  return (
    <div
      className="pointer-events-none absolute right-0 bottom-4 left-0 z-10 flex justify-center"
      style={{ overflowAnchor: "none" }}
    >
      <div
        className={cn(
          "transition-opacity ease-out motion-reduce:transition-none",
          visible
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <ButtonGroup>
          {canGoBack ? (
            <Button onClick={onBack} variant="outline">
              {t("back")}
            </Button>
          ) : null}
          {showLatest ? (
            <Button
              aria-label={t("back-to-latest")}
              onClick={onLatest}
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={ArrowDown02Icon} />
            </Button>
          ) : null}
        </ButtonGroup>
      </div>
    </div>
  );
}
