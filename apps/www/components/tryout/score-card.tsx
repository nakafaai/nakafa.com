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
  FunctionReturnType<typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt>
>["attempt"];
type TryoutAttemptStatus = TryoutAttempt["status"];

export function TryoutScoreCard({
  attempt,
  status,
}: {
  attempt: TryoutAttempt;
  status: TryoutAttemptStatus;
}) {
  const tTryouts = useTranslations("Tryouts");
  const hasScoredQuestions = attempt.totalQuestions > 0;

  return (
    <TryoutStartCountdown className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TryoutScoreStatusBadge status={attempt.scoreStatus} />
        <TryoutAttemptStatusBadge status={status} />
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

function TryoutScoreStatusBadge({
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
      <div className="flex items-center gap-1">
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
