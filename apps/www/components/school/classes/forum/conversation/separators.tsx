import { Badge } from "@repo/design-system/components/ui/badge";
import { cn } from "@repo/design-system/lib/utils";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { getLocale } from "@/lib/utils/date";

/** Renders the calendar separator between transcript day groups. */
export const DateSeparator = memo(({ date }: { date: number }) => {
  const locale = useLocale();

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <time className="shrink-0 text-muted-foreground text-xs">
        {format(date, "d. MMMM yyyy", { locale: getLocale(locale) })}
      </time>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
});
DateSeparator.displayName = "DateSeparator";

/** Renders the unread marker that anchors live or historical unread state. */
export const UnreadSeparator = memo(
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
UnreadSeparator.displayName = "UnreadSeparator";
