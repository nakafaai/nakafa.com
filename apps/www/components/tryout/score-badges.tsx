"use client";

import {
  Certificate02Icon,
  Comet02Icon,
  Compass01Icon,
  Flag03Icon,
  MoonsetIcon,
} from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";

type TryoutAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt>
>["attempt"];

export function TryoutAttemptStatusBadge({
  status,
}: {
  status: TryoutAttempt["status"];
}) {
  const tTryouts = useTranslations("Tryouts");

  if (status === "completed") {
    return (
      <Badge variant="secondary">
        <HugeIcons icon={Flag03Icon} />
        {tTryouts("score-state-completed")}
      </Badge>
    );
  }

  if (status === "expired") {
    return (
      <Badge variant="outline">
        <HugeIcons icon={MoonsetIcon} />
        {tTryouts("score-state-expired")}
      </Badge>
    );
  }

  return (
    <Badge variant="muted">
      <HugeIcons icon={Compass01Icon} />
      {tTryouts("part-status-in-progress")}
    </Badge>
  );
}

export function TryoutScoreStatusBadge({
  status,
}: {
  status: TryoutAttempt["scoreStatus"];
}) {
  const tTryouts = useTranslations("Tryouts");

  if (status === "official") {
    return (
      <Badge variant="default">
        <HugeIcons icon={Certificate02Icon} />
        {tTryouts("score-status-official")}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      <HugeIcons icon={Comet02Icon} />
      {tTryouts("score-status-provisional")}
    </Badge>
  );
}
