"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import {
  TryoutCountdown,
  TryoutCountdownAction,
  TryoutCountdownMeta,
  TryoutCountdownTime,
} from "@/components/tryout/countdown";
import { useTryoutStart } from "@/components/tryout/start-state";

export function TryoutStartCta() {
  const tAuth = useTranslations("Auth");
  const tTryouts = useTranslations("Tryouts");
  const isReady = useTryoutStart((state) => state.state.isReady);
  const hasSubscription = useTryoutStart(
    (state) => state.state.hasSubscription
  );
  const nextPartKey = useTryoutStart((state) => state.state.nextPartKey);
  const remainingTime = useTryoutStart((state) => state.state.remainingTime);
  const isLoading = useTryoutStart((state) => state.state.isLoading);
  const isActionPending = useTryoutStart((state) => state.meta.isActionPending);
  const clickCta = useTryoutStart((state) => state.actions.clickCta);

  if (!isReady) {
    return null;
  }

  let label = tTryouts("start-cta");

  if (hasSubscription === false) {
    label = tAuth("get-pro");
  }

  if (nextPartKey) {
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
      <div className="flex w-full flex-col items-start gap-4">{action}</div>
    );
  }

  const timeSegments = [
    { label: tTryouts("time-hours-short"), value: remainingTime.hours },
    { label: tTryouts("time-minutes-short"), value: remainingTime.minutes },
    { label: tTryouts("time-seconds-short"), value: remainingTime.seconds },
  ];

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <TryoutCountdown>
        <TryoutCountdownTime segments={timeSegments} />
        <TryoutCountdownMeta>
          {tTryouts("remaining-time-label")}
        </TryoutCountdownMeta>
        <TryoutCountdownAction>{action}</TryoutCountdownAction>
      </TryoutCountdown>
    </div>
  );
}
