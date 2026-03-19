"use client";

import { Tick01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

type TryoutStatusBadgeValue = "completed" | "in-progress" | "locked";

export function TryoutStatusBadge({
  status,
}: {
  status: TryoutStatusBadgeValue;
}) {
  const tTryouts = useTranslations("Tryouts");

  switch (status) {
    case "completed":
      return (
        <Badge variant="secondary">
          <HugeIcons icon={Tick01Icon} />
          {tTryouts("part-status-completed")}
        </Badge>
      );
    case "in-progress":
      return (
        <Badge variant="muted">{tTryouts("part-status-in-progress")}</Badge>
      );
    case "locked":
      return <Badge variant="outline">{tTryouts("part-status-locked")}</Badge>;
    default:
      return (
        <Badge variant="muted">{tTryouts("part-status-in-progress")}</Badge>
      );
  }
}
