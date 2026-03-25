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
import { TryoutStatusBadge } from "@/components/tryout/status-badge";

export function TryoutPartStatus() {
  const status = useTryoutPart((state) => state.state.status);

  switch (status) {
    case "loading":
      return <Skeleton className="h-7 w-20 rounded-md" />;
    case "completed":
      return <TryoutStatusBadge status="completed" />;
    default:
      return null;
  }
}

export function TryoutPartMetrics() {
  const tTryouts = useTranslations("Tryouts");
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
