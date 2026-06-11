import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Group } from "@repo/design-system/components/ui/group";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

/** Renders the contextual jump actions for back and latest. */
export const JumpBar = ({
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
          "transition-opacity ease-out motion-reduce:transition-none",
          visible
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <Group>
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
        </Group>
      </div>
    </div>
  );
};
JumpBar.displayName = "JumpBar";
