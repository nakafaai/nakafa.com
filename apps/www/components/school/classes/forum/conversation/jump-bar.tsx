import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";

/** Renders the contextual jump actions for back and latest. */
export const JumpBar = memo(() => {
  const t = useTranslations("Common");
  const backOrigin = useViewport((state) => state.backOrigin);
  const { goBack, goToLatest } = useControls();

  return (
    <div className="absolute right-0 bottom-4 left-0 z-10 flex justify-center">
      <ButtonGroup>
        {backOrigin ? (
          <Button onClick={goBack} variant="outline">
            {t("back")}
          </Button>
        ) : null}

        <Button
          aria-label={t("back-to-latest")}
          onClick={goToLatest}
          size="icon"
          variant="outline"
        >
          <HugeIcons icon={ArrowDown02Icon} />
        </Button>
      </ButtonGroup>
    </div>
  );
});
JumpBar.displayName = "JumpBar";
