import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type { ViewportJumpControl } from "@/components/school/classes/forum/conversation/viewport/model";

/** Renders the contextual jump actions for back and latest. */
export function JumpBar({
  control,
  onBack,
  onLatest,
}: {
  control: ViewportJumpControl;
  onBack: () => void;
  onLatest: () => void;
}) {
  const t = useTranslations("Common");
  const visible = control.kind !== "none";

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
          {control.kind === "back" ? (
            <Button onClick={onBack} variant="outline">
              {t("back")}
            </Button>
          ) : null}
          {control.kind === "latest" ? (
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
