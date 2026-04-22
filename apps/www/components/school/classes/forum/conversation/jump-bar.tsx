import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";

/** Renders the single jump action for returning to latest. */
export const JumpBar = memo(() => {
  const t = useTranslations("Common");
  const scrollToLatest = useViewport((state) => state.scrollToLatest);

  return (
    <div className="absolute right-0 bottom-4 left-0 z-10 flex justify-center">
      <Button
        aria-label={t("back-to-latest")}
        onClick={scrollToLatest}
        size="icon"
        variant="outline"
      >
        <HugeIcons icon={ArrowDown02Icon} />
      </Button>
    </div>
  );
});
JumpBar.displayName = "JumpBar";
