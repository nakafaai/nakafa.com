"use client";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { getLocale } from "@/lib/utils/date";

export const JumpModeIndicator = memo(({ onExit }: { onExit: () => void }) => {
  const t = useTranslations("Common");
  return (
    <div className="absolute right-0 bottom-4 left-0 z-10 flex justify-center">
      <Button onClick={onExit} size="sm" variant="secondary">
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
        {t("back-to-latest")}
      </Button>
    </div>
  );
});
JumpModeIndicator.displayName = "JumpModeIndicator";

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

export const UnreadSeparator = memo(({ count }: { count: number }) => {
  const t = useTranslations("Common");

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-destructive" />
      <Badge variant="destructive">{t("new-messages", { count })}</Badge>
      <div className="h-px flex-1 bg-destructive" />
    </div>
  );
});
UnreadSeparator.displayName = "UnreadSeparator";
