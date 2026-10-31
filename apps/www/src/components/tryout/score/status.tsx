import {
  Award02Icon,
  Certificate02Icon,
  Compass01Icon,
} from "@hugeicons/core-free-icons";
import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";

/** The icon, label and badge variant that say how far one persisted score is settled. */
function scoreStatusOf(
  score: Pick<TryoutScoreResult, "scoreStatus" | "scoringStrategy">
) {
  if (score.scoreStatus === "provisional") {
    return {
      icon: Compass01Icon,
      label: "score-status-estimated",
      variant: "muted",
    } as const;
  }
  if (score.scoringStrategy === "irt") {
    return {
      icon: Certificate02Icon,
      label: "score-status-verified-irt",
      variant: "default",
    } as const;
  }
  return {
    icon: Award02Icon,
    label: "score-status-official",
    variant: "default",
  } as const;
}

/** Renders the canonical filled badge for one persisted score snapshot. */
export function TryoutScoreStatus({
  score,
}: {
  score: Pick<TryoutScoreResult, "scoreStatus" | "scoringStrategy">;
}) {
  const tTryouts = useTranslations("Tryouts");
  const status = scoreStatusOf(score);

  return (
    <Badge variant={status.variant}>
      <HugeIcons icon={status.icon} />
      {tTryouts(status.label)}
    </Badge>
  );
}

/** Says how far one persisted score is settled, as a line of text in a card's footer. */
export function TryoutScoreNote({
  score,
}: {
  score: Pick<TryoutScoreResult, "scoreStatus" | "scoringStrategy">;
}) {
  const tTryouts = useTranslations("Tryouts");
  const status = scoreStatusOf(score);

  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <HugeIcons className="size-4" icon={status.icon} />
      {tTryouts(status.label)}
    </p>
  );
}
