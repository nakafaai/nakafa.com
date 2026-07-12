"use client";

import {
  Award02Icon,
  Certificate02Icon,
  Compass01Icon,
} from "@hugeicons/core-free-icons";
import type { TryoutScoreResult } from "@repo/backend/convex/tryouts/schema";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

/** Renders the canonical filled badge for one persisted score snapshot. */
export function TryoutScoreStatus({
  score,
}: {
  score: Pick<TryoutScoreResult, "scoreStatus" | "scoringStrategy">;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (score.scoreStatus === "provisional") {
    return (
      <Badge variant="muted">
        <HugeIcons icon={Compass01Icon} />
        {tTryouts("score-status-estimated")}
      </Badge>
    );
  }

  if (score.scoringStrategy === "irt") {
    return (
      <Badge variant="default">
        <HugeIcons icon={Certificate02Icon} />
        {tTryouts("score-status-verified-irt")}
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      <HugeIcons icon={Award02Icon} />
      {tTryouts("score-status-official")}
    </Badge>
  );
}
