"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { TryoutScoreCard } from "@/components/tryout/score-card";
import {
  TryoutStartCountdown,
  TryoutStartCountdownAction,
  TryoutStartCountdownMeta,
  TryoutStartCountdownTime,
} from "@/components/tryout/start-countdown";
import type { TryoutStartValue } from "@/components/tryout/start-state";

export function TryoutStartCta({ value }: { value: TryoutStartValue }) {
  const tAuth = useTranslations("Auth");
  const tTryouts = useTranslations("Tryouts");
  const attempt = value.state.attemptData?.attempt;
  const attemptStatus = value.state.effectiveStatus;
  const clickCta = value.actions.clickCta;
  const hasFinishedAttempt = value.state.hasFinishedAttempt;
  const hasSubscription = value.state.hasSubscription;
  const isActionPending = value.meta.isActionPending;
  const isLoading = value.state.isLoading;
  const isReady = value.state.isReady;
  const remainingTime = value.state.remainingTime;
  const resumePartKey = value.state.resumePartKey;

  if (!isReady) {
    return null;
  }

  let label = tTryouts("start-cta");

  if (hasFinishedAttempt) {
    label = tTryouts("restart-cta");
  }

  if (hasSubscription === false) {
    label = tAuth("get-pro");
  }

  if (resumePartKey) {
    label = tTryouts("continue-cta");
  }

  const action = (
    <Button disabled={isLoading} onClick={clickCta}>
      <Spinner icon={Rocket01Icon} isLoading={isActionPending} />
      {label}
    </Button>
  );

  if (!remainingTime) {
    return (
      <div className="flex w-full flex-col items-start gap-4">
        {attempt && hasFinishedAttempt ? (
          <TryoutScoreCard
            attempt={attempt}
            status={attemptStatus ?? attempt.status}
          />
        ) : null}
        {action}
      </div>
    );
  }

  const timeSegments = [
    { label: tTryouts("time-hours-short"), value: remainingTime.hours },
    { label: tTryouts("time-minutes-short"), value: remainingTime.minutes },
    { label: tTryouts("time-seconds-short"), value: remainingTime.seconds },
  ];

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {attempt && hasFinishedAttempt ? (
        <TryoutScoreCard
          attempt={attempt}
          status={attemptStatus ?? attempt.status}
        />
      ) : null}
      <TryoutStartCountdown>
        <TryoutStartCountdownTime segments={timeSegments} />
        <TryoutStartCountdownMeta>
          {tTryouts("remaining-time-label")}
        </TryoutStartCountdownMeta>
        {resumePartKey ? (
          <TryoutStartCountdownAction>{action}</TryoutStartCountdownAction>
        ) : null}
      </TryoutStartCountdown>
    </div>
  );
}
