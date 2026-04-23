import { format } from "date-fns";
import { useLocale } from "next-intl";
import { memo } from "react";
import { getLocale } from "@/lib/utils/date";

/** Renders the calendar separator between transcript day groups. */
export const ConversationDateSeparator = memo(
  ({ value }: { value: number }) => {
    const locale = useLocale();

    return (
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border" />
        <time className="shrink-0 text-muted-foreground text-xs">
          {format(value, "d. MMMM yyyy", { locale: getLocale(locale) })}
        </time>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }
);
ConversationDateSeparator.displayName = "ConversationDateSeparator";
