"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { TryoutAttemptResults } from "@/components/tryout/attempt-results";
import { useTryoutStart } from "@/components/tryout/providers/start-state";
import {
  TryoutStartCountdown,
  TryoutStartCountdownAction,
  TryoutStartCountdownMeta,
  TryoutStartCountdownTime,
} from "@/components/tryout/start-countdown";

function TryoutStartActionButton({
  isActionPending,
  isLoading,
  label,
  onClickAction,
}: {
  isActionPending: boolean;
  isLoading: boolean;
  label: string;
  onClickAction: () => void;
}) {
  return (
    <Button disabled={isLoading} onClick={onClickAction}>
      <Spinner icon={Rocket01Icon} isLoading={isActionPending} />
      {label}
    </Button>
  );
}

export function TryoutStartCta() {
  const tTryouts = useTranslations("Tryouts");
  const attempt = useTryoutStart((state) => state.state.attempt);
  const attemptStatus = useTryoutStart((state) => state.state.attemptStatus);
  const clickCtaAction = useTryoutStart(
    (state) => state.actions.clickCtaAction
  );
  const hasFinishedAttempt = useTryoutStart(
    (state) => state.state.hasFinishedAttempt
  );
  const isActionPending = useTryoutStart((state) => state.meta.isActionPending);
  const isLoading = useTryoutStart((state) => state.state.isLoading);
  const isReady = useTryoutStart((state) => state.state.isReady);
  const remainingTime = useTryoutStart((state) => state.state.remainingTime);
  const resumePartKey = useTryoutStart((state) => state.state.resumePartKey);

  if (!isReady) {
    return null;
  }

  let label = tTryouts("start-cta");

  if (hasFinishedAttempt) {
    label = tTryouts("restart-cta");
  }

  if (resumePartKey) {
    label = tTryouts("continue-cta");
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {attempt && hasFinishedAttempt ? (
        <TryoutAttemptResults
          fallbackAttempt={attempt}
          fallbackStatus={attemptStatus ?? attempt.status}
        />
      ) : null}

      {remainingTime ? (
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
            <TryoutStartCountdownAction>
              <TryoutStartActionButton
                isActionPending={isActionPending}
                isLoading={isLoading}
                label={label}
                onClickAction={clickCtaAction}
              />
            </TryoutStartCountdownAction>
          ) : null}
        </TryoutStartCountdown>
      ) : (
        <TryoutStartActionButton
          isActionPending={isActionPending}
          isLoading={isLoading}
          label={label}
          onClickAction={clickCtaAction}
        />
      )}
    </div>
  );
}
