"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutStartCountdown } from "@/components/tryout/start-countdown";

type TryoutAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempts.getUserTryoutAttempt>
>["attempt"];

export function TryoutScoreCard({ attempt }: { attempt: TryoutAttempt }) {
  const tTryouts = useTranslations("Tryouts");
  const hasScoredQuestions = attempt.totalQuestions > 0;

  return (
    <TryoutStartCountdown className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TryoutScoreStatusBadge status={attempt.scoreStatus} />
        <TryoutAttemptStatusBadge status={attempt.status} />
      </div>

      <div className="space-y-1">
        <h2 className="font-medium text-foreground text-lg">
          {tTryouts("score-card-title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {getTryoutScoreDescription({
            scoreStatus: attempt.scoreStatus,
            status: attempt.status,
            tTryouts,
          })}
        </p>
      </div>

      {hasScoredQuestions ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TryoutScoreStat label={tTryouts("score-label")}>
            <div className="font-light font-mono text-4xl text-foreground tabular-nums leading-none tracking-tighter">
              <NumberFormat
                format={{ maximumFractionDigits: 0 }}
                trend={0}
                value={attempt.irtScore}
              />
            </div>
          </TryoutScoreStat>

          <TryoutScoreStat label={tTryouts("correct-answers-label")}>
            <div className="font-light font-mono text-4xl text-foreground tabular-nums leading-none tracking-tighter">
              {attempt.totalCorrect}/{attempt.totalQuestions}
            </div>
          </TryoutScoreStat>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {tTryouts("score-card-no-answers")}
        </p>
      )}

      <p className="text-muted-foreground text-sm">
        {tTryouts("score-card-review-hint")}
      </p>
    </TryoutStartCountdown>
  );
}

function TryoutAttemptStatusBadge({
  status,
}: {
  status: TryoutAttempt["status"];
}) {
  const tTryouts = useTranslations("Tryouts");

  if (status === "completed") {
    return (
      <Badge variant="secondary">{tTryouts("score-state-completed")}</Badge>
    );
  }

  if (status === "expired") {
    return <Badge variant="outline">{tTryouts("score-state-expired")}</Badge>;
  }

  return <Badge variant="muted">{tTryouts("part-status-in-progress")}</Badge>;
}

function TryoutScoreStatusBadge({
  status,
}: {
  status: TryoutAttempt["scoreStatus"];
}) {
  const tTryouts = useTranslations("Tryouts");

  if (status === "official") {
    return (
      <Badge variant="secondary">{tTryouts("score-status-official")}</Badge>
    );
  }

  return (
    <Badge variant="outline">{tTryouts("score-status-provisional")}</Badge>
  );
}

function TryoutScoreStat({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-background/70 p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      {children}
    </div>
  );
}

function getTryoutScoreDescription({
  scoreStatus,
  status,
  tTryouts,
}: {
  scoreStatus: TryoutAttempt["scoreStatus"];
  status: TryoutAttempt["status"];
  tTryouts: ReturnType<typeof useTranslations>;
}) {
  if (scoreStatus === "official") {
    if (status === "expired") {
      return tTryouts("score-card-official-expired");
    }

    return tTryouts("score-card-official-completed");
  }

  if (status === "expired") {
    return tTryouts("score-card-provisional-expired");
  }

  return tTryouts("score-card-provisional-completed");
}
