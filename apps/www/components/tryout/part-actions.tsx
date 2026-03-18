"use client";

import { Rocket01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { Countdown } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/attempt-countdown";
import { ExerciseStats } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/attempt-stats";
import { useTryoutPart } from "@/components/tryout/part-state";
import { TryoutStartButton } from "@/components/tryout/start-button";

export function TryoutPartSticky() {
  const tTryouts = useTranslations("Tryouts");
  const showSticky = useTryoutPart((state) =>
    Boolean(state.state.partAttempt && !state.state.partCompleted)
  );
  const timer = useTryoutPart((state) => state.state.timer);
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const setCompleteDialogOpen = useTryoutPart(
    (state) => state.actions.setCompleteDialogOpen
  );

  if (!showSticky) {
    return null;
  }

  return (
    <div className="sticky top-18 z-1 lg:top-2">
      <div className="flex flex-col rounded-xl border bg-card p-2 shadow-sm">
        <div className="flex items-center justify-between">
          <Countdown timer={timer} />

          <Button
            onClick={() => setCompleteDialogOpen(true)}
            type="button"
            variant="destructive"
          >
            <Spinner icon={StopIcon} isLoading={isActionPending} />
            {tTryouts("complete-part-cta")}
          </Button>
        </div>

        <ExerciseStats />
      </div>
    </div>
  );
}

export function TryoutPartTryoutCta() {
  const shouldShowTryoutStartButton = useTryoutPart(
    (state) => state.state.shouldShowTryoutStartButton
  );
  const tryout = useTryoutPart((state) => state.state.tryout);

  if (!shouldShowTryoutStartButton) {
    return null;
  }

  return (
    <TryoutStartButton
      locale={tryout.locale}
      product={tryout.product}
      tryoutSlug={tryout.slug}
    />
  );
}

export function TryoutPartStartCta() {
  const tTryouts = useTranslations("Tryouts");
  const isRuntimePending = useTryoutPart(
    (state) => state.state.isRuntimePending
  );
  const canStartPart = useTryoutPart((state) => state.state.canStartPart);
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const startPart = useTryoutPart((state) => state.actions.startPart);

  if (isRuntimePending || !canStartPart) {
    return null;
  }

  return (
    <Button disabled={isActionPending} onClick={startPart} type="button">
      <Spinner icon={Rocket01Icon} isLoading={isActionPending} />
      {tTryouts("start-part-cta")}
    </Button>
  );
}

export function TryoutPartBackCta() {
  const tTryouts = useTranslations("Tryouts");
  const isRuntimePending = useTryoutPart(
    (state) => state.state.isRuntimePending
  );
  const partCompleted = useTryoutPart((state) => state.state.partCompleted);
  const goToSet = useTryoutPart((state) => state.actions.goToSet);

  if (isRuntimePending || !partCompleted) {
    return null;
  }

  return (
    <Button onClick={goToSet} type="button" variant="outline">
      {tTryouts("back-to-set-cta")}
    </Button>
  );
}

export function TryoutPartDialog() {
  const tTryouts = useTranslations("Tryouts");
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const isCompleteDialogOpen = useTryoutPart(
    (state) => state.meta.isCompleteDialogOpen
  );
  const completePart = useTryoutPart((state) => state.actions.completePart);
  const setCompleteDialogOpen = useTryoutPart(
    (state) => state.actions.setCompleteDialogOpen
  );

  return (
    <ResponsiveDialog
      description={tTryouts("complete-part-description")}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setCompleteDialogOpen(false)}
            type="button"
            variant="outline"
          >
            {tTryouts("cancel-cta")}
          </Button>
          <Button
            disabled={isActionPending}
            onClick={completePart}
            type="button"
            variant="destructive"
          >
            <Spinner icon={StopIcon} isLoading={isActionPending} />
            {tTryouts("complete-part-cta")}
          </Button>
        </div>
      }
      open={isCompleteDialogOpen}
      setOpen={setCompleteDialogOpen}
      title={tTryouts("complete-part-title")}
    />
  );
}
