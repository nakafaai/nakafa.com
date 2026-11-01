import { CloudOffIcon } from "@hugeicons/core-free-icons";
import { useNetwork } from "@mantine/hooks";
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
 * Whether the page has no connection. The browser knows at once when the device leaves its network, and the
 * client notices a connection that went quiet about a minute later, so each answers for the other.
 */
export function useOffline() {
  const { online } = useNetwork();
  const connection = useConvexConnectionState();

  return !online || isConvexOffline(connection);
}

/**
 * What a page that saves as the person works says while the connection is gone: the exam editor's
 * header, the paper's bar and the try-out player's header. The person keeps working, and every change
 * waits on the page and saves once the connection is back. A phone shows the icon, which names it in
 * its tooltip. A page on a good connection says nothing.
 */
export function OfflineNote() {
  const t = useTranslations("Common");
  const offline = useOffline();

  if (!offline) {
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
