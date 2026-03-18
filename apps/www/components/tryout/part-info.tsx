"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useTryoutPart } from "@/components/tryout/part-state";

export function TryoutPartStatus() {
  const tTryouts = useTranslations("Tryouts");
  const isRuntimePending = useTryoutPart(
    (state) => state.state.isRuntimePending
  );
  const partCompleted = useTryoutPart((state) => state.state.partCompleted);
  const canContinuePart = useTryoutPart((state) => state.state.canContinuePart);
  const questionCount = useTryoutPart(
    (state) => state.state.part.questionCount
  );

  if (isRuntimePending) {
    return <Skeleton className="h-7 w-20 rounded-md" />;
  }

  if (partCompleted) {
    return <Badge variant="muted">{tTryouts("part-status-completed")}</Badge>;
  }

  if (canContinuePart) {
    return <Badge variant="muted">{tTryouts("part-status-in-progress")}</Badge>;
  }

  return (
    <Badge variant="muted">
      <NumberFormat value={questionCount} /> {tTryouts("question-unit")}
    </Badge>
  );
}

export function TryoutPartTime() {
  const isRuntimePending = useTryoutPart(
    (state) => state.state.isRuntimePending
  );
  const timeLimitSeconds = useTryoutPart(
    (state) => state.state.part.timeLimitSeconds
  );

  if (isRuntimePending) {
    return <Skeleton className="h-7 w-20 rounded-md" />;
  }

  return <Badge variant="muted">{formatTimeLimit(timeLimitSeconds)}</Badge>;
}

export function TryoutPartDesc() {
  const tTryouts = useTranslations("Tryouts");
  const isRuntimePending = useTryoutPart(
    (state) => state.state.isRuntimePending
  );
  const hasStartedTryout = useTryoutPart(
    (state) => state.state.hasStartedTryout
  );
  const tryoutInProgress = useTryoutPart(
    (state) => state.state.tryoutInProgress
  );
  const partCompleted = useTryoutPart((state) => state.state.partCompleted);
  const canContinuePart = useTryoutPart((state) => state.state.canContinuePart);
  const partLabel = useTryoutPart((state) => state.state.part.label);
  const questionCount = useTryoutPart(
    (state) => state.state.part.questionCount
  );

  if (isRuntimePending) {
    return (
      <div className="max-w-2xl space-y-2">
        <Skeleton className="h-4 w-72 rounded-sm" />
        <Skeleton className="h-4 w-56 rounded-sm" />
      </div>
    );
  }

  let description = tTryouts("part-start-description", {
    count: questionCount,
    part: partLabel,
  });

  if (!hasStartedTryout) {
    description = tTryouts("part-start-tryout-description", {
      part: partLabel,
    });
  } else if (!tryoutInProgress) {
    description = tTryouts("part-tryout-ended-description", {
      part: partLabel,
    });
  } else if (partCompleted) {
    description = tTryouts("part-completed-description", {
      part: partLabel,
    });
  } else if (canContinuePart) {
    description = tTryouts("part-continue-description", {
      part: partLabel,
    });
  }

  return <p className="max-w-2xl text-muted-foreground">{description}</p>;
}

function formatTimeLimit(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}
