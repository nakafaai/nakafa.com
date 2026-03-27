"use client";

import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import {
  TryoutPartStat,
  TryoutPartStats,
} from "@/components/tryout/part-shell";
import { useTryoutPart } from "@/components/tryout/providers/part-state";
import {
  TryoutAttemptStatusBadge,
  TryoutScoreStatusBadge,
} from "@/components/tryout/score-badges";
import { TryoutStatusBadge } from "@/components/tryout/status-badge";

export function TryoutPartStatus() {
  const isTryoutFinished = useTryoutPart(
    (state) => state.state.isTryoutFinished
  );
  const status = useTryoutPart((state) => state.state.status);
  const tryoutAttemptStatus = useTryoutPart(
    (state) => state.state.tryoutAttemptStatus
  );
  const tryoutScoreStatus = useTryoutPart(
    (state) => state.state.tryoutScoreStatus
  );

  if (status === "loading") {
    return (
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    );
  }

  if (isTryoutFinished && tryoutAttemptStatus && tryoutScoreStatus) {
    return (
      <div className="flex flex-wrap gap-2">
        <TryoutScoreStatusBadge status={tryoutScoreStatus} />
        <TryoutAttemptStatusBadge status={tryoutAttemptStatus} />
      </div>
    );
  }

  if (status === "completed") {
    return <TryoutStatusBadge status="completed" />;
  }

  return null;
}

export function TryoutPartMetrics() {
  const tTryouts = useTranslations("Tryouts");
  const isTryoutFinished = useTryoutPart(
    (state) => state.state.isTryoutFinished
  );
  const score = useTryoutPart((state) => state.state.score);
  const status = useTryoutPart((state) => state.state.status);
  const questionCount = useTryoutPart(
    (state) => state.state.part.questionCount
  );
  const timeLimitSeconds = useTryoutPart(
    (state) => state.state.part.timeLimitSeconds
  );

  if (status === "loading") {
    return (
      <TryoutPartStats>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </TryoutPartStats>
    );
  }

  if (isTryoutFinished && score) {
    return (
      <TryoutPartStats>
        <TryoutPartStat label={tTryouts("score-label")}>
          <TryoutMetricNumber value={score.irtScore} />
        </TryoutPartStat>

        <TryoutPartStat label={tTryouts("correct-answers-label")}>
          <TryoutMetricFraction
            correct={score.correctAnswers}
            total={questionCount}
          />
        </TryoutPartStat>
      </TryoutPartStats>
    );
  }

  return (
    <TryoutPartStats>
      <TryoutPartStat label={tTryouts("part-questions-label")}>
        <TryoutMetricNumber value={questionCount} />
      </TryoutPartStat>

      <TryoutPartStat label={tTryouts("part-time-label")}>
        <TryoutMetricTime totalSeconds={timeLimitSeconds} />
      </TryoutPartStat>
    </TryoutPartStats>
  );
}

function TryoutMetricNumber({ value }: { value: number }) {
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

function TryoutMetricTime({ totalSeconds }: { totalSeconds: number }) {
  const segments = getTimeSegments(totalSeconds);

  return (
    <NumberFormatGroup>
      <div className="flex items-center gap-2 sm:gap-3">
        {segments.map((segment, index) => (
          <Fragment key={`${segment.label}-${segment.value}`}>
            <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
              <NumberFormat
                format={{ minimumIntegerDigits: 2 }}
                trend={0}
                value={segment.value}
              />
            </div>
            {index < segments.length - 1 ? (
              <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
                :
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </NumberFormatGroup>
  );
}

function TryoutMetricFraction({
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

/** Splits a duration into the visible time segments for the UI. */
function getTimeSegments(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      { label: "hours", value: hours },
      { label: "minutes", value: minutes },
      { label: "seconds", value: seconds },
    ] as const;
  }

  return [
    { label: "minutes", value: minutes },
    { label: "seconds", value: seconds },
  ] as const;
}
