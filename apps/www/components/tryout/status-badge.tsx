"use client";

import {
  Compass01Icon,
  Flag03Icon,
  MoonsetIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

type TryoutStatusBadgeValue = "completed" | "expired" | "in-progress";

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
          <HugeIcons icon={Flag03Icon} />
          {tTryouts("part-status-completed")}
        </Badge>
      );
    case "in-progress":
      return (
        <Badge variant="muted">
          <HugeIcons icon={Compass01Icon} />
          {tTryouts("part-status-in-progress")}
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="outline">
          <HugeIcons icon={MoonsetIcon} />
          {tTryouts("part-status-expired")}
        </Badge>
      );
    default: {
      const exhaustiveStatus: never = status;

      return exhaustiveStatus;
    }
  }
}
