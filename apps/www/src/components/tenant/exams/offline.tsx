import { CloudOffIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { statusIconVariants } from "@repo/design-system/lib/status";
import { useConvexConnectionState } from "convex/react";
import { useTranslations } from "use-intl";
import { isConvexOffline } from "@/lib/convex/online";

/**
 * What the editor's header and the paper's bar say while the connection is gone: the person keeps
 * working, and every change waits on the page and saves once the connection is back. A phone shows
 * the icon, which names it in its tooltip.
 */
export function ExamOffline() {
  const t = useTranslations("Exams");
  const connection = useConvexConnectionState();

  if (!isConvexOffline(connection)) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs" />
        }
      >
        <HugeIcons
          aria-hidden="true"
          className={statusIconVariants({
            className: "size-3.5",
            tone: "warning",
          })}
          icon={CloudOffIcon}
        />
        <span className="max-md:sr-only">{t("offline-note")}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("offline-note")}</TooltipContent>
    </Tooltip>
  );
}
