"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import {
  TryoutPartStat,
  TryoutPartStats,
} from "@/components/tryout/part-shell";
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

      {hasScoredQuestions ? (
        <TryoutPartStats>
          <TryoutPartStat label={tTryouts("score-label")}>
            <TryoutScoreMetricNumber value={attempt.irtScore} />
          </TryoutPartStat>

          <TryoutPartStat label={tTryouts("correct-answers-label")}>
            <TryoutScoreMetricFraction
              correct={attempt.totalCorrect}
              total={attempt.totalQuestions}
            />
          </TryoutPartStat>
        </TryoutPartStats>
      ) : (
        <p className="text-muted-foreground text-sm">
          {tTryouts("score-card-no-answers")}
        </p>
      )}

      <p className="pt-2 text-muted-foreground text-sm">
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

function TryoutScoreMetricNumber({ value }: { value: number }) {
  return (
    <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
      <NumberFormat
        format={{ maximumFractionDigits: 0 }}
        trend={0}
        value={value}
      />
    </div>
  );
}

function TryoutScoreMetricFraction({
  correct,
  total,
}: {
  correct: number;
  total: number;
}) {
  return (
    <NumberFormatGroup>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
          <NumberFormat
            format={{ maximumFractionDigits: 0 }}
            trend={0}
            value={correct}
          />
        </div>
        <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
          /
        </span>
        <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
          <NumberFormat
            format={{ maximumFractionDigits: 0 }}
            trend={0}
            value={total}
          />
        </div>
      </div>
    </NumberFormatGroup>
  );
}
