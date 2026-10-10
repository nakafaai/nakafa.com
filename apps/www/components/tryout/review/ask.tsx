"use client";

import { StarsIcon } from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useNinaAsk } from "@/components/ai/ask";
import { preloadAiSheet } from "@/components/ai/sheet/module";

/** Warms Nina before the learner finishes the tap. */
function preloadOnIntent() {
  Effect.runFork(preloadAiSheet(true));
}

/** Asks Nina about one reviewed question; the backend reads it in full. */
export function TryoutAskButton({
  attemptId,
  placementId,
  questionOrder,
}: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly placementId: Id<"tryoutAttemptPlacements">;
  readonly questionOrder: number;
}) {
  const ask = useNinaAsk();
  const tAi = useTranslations("Ai");
  const tTryouts = useTranslations("Tryouts");

  return (
    <Button
      onClick={() =>
        ask({
          focus: { kind: "tryout-question", attemptId, placementId },
          text: tTryouts("ask-nina-prompt", { number: questionOrder }),
        })
      }
      onFocus={preloadOnIntent}
      onMouseEnter={preloadOnIntent}
      onTouchStart={preloadOnIntent}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={StarsIcon} />
      <span className="sr-only @[24rem]:not-sr-only">{tAi("ask-nina")}</span>
    </Button>
  );
}
