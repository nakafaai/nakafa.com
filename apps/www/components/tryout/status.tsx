"use client";

import {
  CheckmarkCircle02Icon,
  CircleDashedIcon,
  ClockAlertIcon,
  PlayCircle02Icon,
} from "@hugeicons/core-free-icons";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

export type TryoutStatusValue = Doc<"tryoutSetProgress">["status"];
type TryoutStatus = TryoutStatusValue | null;

function getStatusIcon(status: TryoutStatus) {
  if (status === "in-progress") {
    return PlayCircle02Icon;
  }

  if (status === "completed") {
    return CheckmarkCircle02Icon;
  }

  if (status === "expired") {
    return ClockAlertIcon;
  }

  return CircleDashedIcon;
}

function getStatusLabelKey(status: TryoutStatus) {
  if (status === "in-progress") {
    return "status-in-progress" as const;
  }

  if (status === "completed") {
    return "status-completed" as const;
  }

  if (status === "expired") {
    return "status-expired" as const;
  }

  return "status-not-started" as const;
}

function getStatusVariant(status: TryoutStatus) {
  if (status === "in-progress") {
    return "default" as const;
  }

  if (status === "completed") {
    return "secondary" as const;
  }

  if (status === "expired") {
    return "destructive" as const;
  }

  return "muted" as const;
}

/** Renders the shared icon for one try-out workflow status. */
export function TryoutStatusIcon({ status }: { status: TryoutStatus }) {
  return <HugeIcons data-icon="inline-start" icon={getStatusIcon(status)} />;
}

/** Renders the localized label for one try-out workflow status. */
export function TryoutStatusLabel({
  className,
  status,
}: {
  className?: ComponentProps<"span">["className"];
  status: TryoutStatus;
}) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <span className={className}>{tTryouts(getStatusLabelKey(status))}</span>
  );
}

/** Renders one consistent, filled try-out workflow badge. */
export function TryoutStatus({ status }: { status: TryoutStatus }) {
  return (
    <Badge variant={getStatusVariant(status)}>
      <TryoutStatusIcon status={status} />
      <TryoutStatusLabel status={status} />
    </Badge>
  );
}

/** Renders a narrow workflow badge without hiding its accessible label. */
export function TryoutStatusCompact({ status }: { status: TryoutStatus }) {
  return (
    <Badge variant={getStatusVariant(status)}>
      <TryoutStatusIcon status={status} />
      <TryoutStatusLabel
        className="sr-only sm:not-sr-only sm:whitespace-nowrap"
        status={status}
      />
    </Badge>
  );
}
