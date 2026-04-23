import { Badge } from "@repo/design-system/components/ui/badge";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { memo } from "react";

/** Renders the unread marker between the last read post and the next unread post. */
export const ConversationUnreadSeparator = memo(
  ({ count, status }: { count: number; status: "history" | "new" }) => {
    const t = useTranslations("Common");
    const isHistory = status === "history";

    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className={cn(
            "h-px flex-1",
            isHistory ? "bg-muted" : "bg-destructive"
          )}
        />
        <Badge variant={isHistory ? "muted" : "destructive"}>
          {isHistory ? t("left-off-here") : t("new-messages", { count })}
        </Badge>
        <div
          className={cn(
            "h-px flex-1",
            isHistory ? "bg-muted" : "bg-destructive"
          )}
        />
      </div>
    );
  }
);
ConversationUnreadSeparator.displayName = "ConversationUnreadSeparator";
