import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";

/** Renders the contextual jump actions for going back or returning to latest. */
export const JumpBar = memo(
  ({ showBack, showLatest }: { showBack: boolean; showLatest: boolean }) => {
    const t = useTranslations("Common");
    const goBack = useConversation((state) => state.goBack);
    const scrollToLatest = useConversation((state) => state.scrollToLatest);

    if (!(showBack || showLatest)) {
      return null;
    }

    return (
      <div className="absolute right-0 bottom-4 left-0 z-10 flex justify-center">
        <ButtonGroup>
          {showBack ? (
            <Button onClick={goBack} variant="outline">
              {t("back")}
            </Button>
          ) : null}
          {showLatest ? (
            <Button
              aria-label={t("back-to-latest")}
              onClick={scrollToLatest}
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={ArrowDown02Icon} />
            </Button>
          ) : null}
        </ButtonGroup>
      </div>
    );
  }
);
JumpBar.displayName = "JumpBar";
