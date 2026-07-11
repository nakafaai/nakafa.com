"use client";

import {
  CheckmarkCircle02Icon,
  CircleDashedIcon,
  ClockAlertIcon,
  PlayCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

export type TryoutStatusValue = "in-progress" | "completed" | "expired";

/** Renders one consistent, contextual try-out workflow badge. */
export function TryoutStatus({ status }: { status: TryoutStatusValue | null }) {
  const tTryouts = useTranslations("Tryouts");

  if (status === "in-progress") {
    return (
      <Badge variant="default-subtle">
        <HugeIcons icon={PlayCircle02Icon} />
        {tTryouts("status-in-progress")}
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge variant="secondary">
        <HugeIcons icon={CheckmarkCircle02Icon} />
        {tTryouts("status-completed")}
      </Badge>
    );
  }

  if (status === "expired") {
    return (
      <Badge variant="destructive-subtle">
        <HugeIcons icon={ClockAlertIcon} />
        {tTryouts("status-expired")}
      </Badge>
    );
  }

  return (
    <Badge variant="muted">
      <HugeIcons icon={CircleDashedIcon} />
      {tTryouts("status-not-started")}
    </Badge>
  );
}
