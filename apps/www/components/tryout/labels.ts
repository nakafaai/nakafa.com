import type { TryoutScoringStrategy } from "@repo/backend/convex/tryouts/schema";
import type { useTranslations } from "next-intl";

type TryoutTranslations = ReturnType<typeof useTranslations<"Tryouts">>;

/** Returns the localized label for one try-out scoring strategy. */
export function getTryoutScoringLabel(
  tTryouts: TryoutTranslations,
  strategy: TryoutScoringStrategy
) {
  if (strategy === "irt") {
    return tTryouts("scoring-irt");
  }

  if (strategy === "weighted") {
    return tTryouts("scoring-weighted");
  }

  return tTryouts("scoring-raw");
}
