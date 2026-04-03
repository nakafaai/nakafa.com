"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useTryoutAttemptState } from "@/components/tryout/providers/attempt-state";
import { TryoutScoreCard } from "@/components/tryout/score-card";

type TryoutAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt>
>["attempt"];

interface Props {
  fallbackAttempt: TryoutAttempt;
  fallbackStatus: TryoutAttempt["status"];
}

export function TryoutAttemptResults({
  fallbackAttempt,
  fallbackStatus,
}: Props) {
  const tTryouts = useTranslations("Tryouts");
  const locale = useTryoutAttemptState((state) => state.params.locale);
  const product = useTryoutAttemptState((state) => state.params.product);
  const tryoutSlug = useTryoutAttemptState((state) => state.params.tryoutSlug);
  const { data: attemptHistory } = useQueryWithStatus(
    api.tryouts.queries.me.history.getUserTryoutAttemptHistory,
    {
      locale,
      product,
      tryoutSlug,
    }
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState("");

  if (!(attemptHistory && attemptHistory.length > 0)) {
    return (
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
    );
  }

  const defaultAttempt =
    attemptHistory.find((attempt) => attempt.countsForCompetition) ??
    attemptHistory.at(-1) ??
    null;
  const selectedAttempt =
    attemptHistory.find((attempt) => attempt.attemptId === selectedAttemptId) ??
    defaultAttempt;

  if (!selectedAttempt) {
    return (
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
    );
  }

  return (
    <div className="space-y-4">
      <TryoutScoreCard
        attempt={selectedAttempt}
        status={selectedAttempt.status}
      />

      {attemptHistory.length > 1 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            {tTryouts("attempt-history-title")}
          </p>
          <div className="flex flex-wrap gap-2">
            {attemptHistory.map((attempt) => {
              const isSelected =
                attempt.attemptId === selectedAttempt.attemptId;

              return (
                <Button
                  key={attempt.attemptId}
                  onClick={() => setSelectedAttemptId(attempt.attemptId)}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                >
                  <span className="flex flex-col items-start text-left">
                    <span>
                      {tTryouts("attempt-history-label", {
                        number: attempt.attemptNumber,
                      })}
                    </span>
                    <span className="text-xs opacity-80">
                      {attempt.countsForCompetition
                        ? tTryouts("attempt-history-counted")
                        : tTryouts("attempt-history-practice")}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
