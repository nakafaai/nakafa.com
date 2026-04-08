"use client";

import { useTranslations } from "next-intl";
import { TryoutAttemptResults } from "@/components/tryout/attempt-results";
import { useTryoutSet } from "@/components/tryout/providers/set-state";
import { TryoutStartActionButton } from "@/components/tryout/start-controls";
import {
  TryoutStartCountdown,
  TryoutStartCountdownAction,
  TryoutStartCountdownMeta,
  TryoutStartCountdownTime,
} from "@/components/tryout/start-countdown";

/** Renders the full set-route start CTA, including countdown and past results. */
export function TryoutStartCta() {
  const tTryouts = useTranslations("Tryouts");
  const attempt = useTryoutSet((state) => state.state.attempt);
  const effectiveStatus = useTryoutSet((state) => state.state.effectiveStatus);
  const clickStartAction = useTryoutSet(
    (state) => state.actions.clickStartAction
  );
  const hasFinishedAttempt = useTryoutSet(
    (state) => state.state.hasFinishedAttempt
  );
  const isActionPending = useTryoutSet((state) => state.meta.isActionPending);
  const isStartBlocked = useTryoutSet((state) => state.meta.isStartBlocked);
  const prefetchAuthAction = useTryoutSet(
    (state) => state.actions.prefetchAuthAction
  );
  const remainingTime = useTryoutSet((state) => state.state.remainingTime);
  const resumePartKey = useTryoutSet((state) => state.state.resumePartKey);

  let label = tTryouts("start-cta");

  if (hasFinishedAttempt) {
    label = tTryouts("restart-cta");
  }

  if (resumePartKey) {
    label = tTryouts("continue-cta");
  }

  let content = (
    <TryoutStartActionButton
      disabled={isStartBlocked}
      isPending={isActionPending}
      onClick={clickStartAction}
      onFocus={prefetchAuthAction}
      onMouseEnter={prefetchAuthAction}
    >
      {label}
    </TryoutStartActionButton>
  );

  if (attempt && hasFinishedAttempt) {
    content = (
      <TryoutAttemptResults
        action={content}
        fallbackAttempt={attempt}
        fallbackStatus={effectiveStatus ?? attempt.status}
      />
    );
  } else if (remainingTime) {
    content = (
      <TryoutStartCountdown>
        <TryoutStartCountdownTime
          segments={[
            {
              label: tTryouts("time-hours-short"),
              value: remainingTime.hours,
            },
            {
              label: tTryouts("time-minutes-short"),
              value: remainingTime.minutes,
            },
            {
              label: tTryouts("time-seconds-short"),
              value: remainingTime.seconds,
            },
          ]}
        />
        <TryoutStartCountdownMeta>
          {tTryouts("remaining-time-label")}
        </TryoutStartCountdownMeta>

        {resumePartKey ? (
          <TryoutStartCountdownAction>{content}</TryoutStartCountdownAction>
        ) : null}
      </TryoutStartCountdown>
    );
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">{content}</div>
  );
}
