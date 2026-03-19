"use client";

import {
  ArrowLeft02Icon,
  Rocket01Icon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Countdown } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/attempt-countdown";
import { ExerciseStats } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/attempt-stats";
import { useTryoutPart } from "@/components/tryout/part-state";
import { TryoutStartButton } from "@/components/tryout/start-button";
import { useStickyVisibility } from "@/lib/hooks/use-sticky-visibility";

export function TryoutPartSticky() {
  const tTryouts = useTranslations("Tryouts");
  const showSticky = useTryoutPart(
    (state) => state.state.status === "in-progress"
  );
  const timer = useTryoutPart((state) => state.state.timer);
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const { anchorRef, hidden } = useStickyVisibility();
  const setCompleteDialogOpen = useTryoutPart(
    (state) => state.actions.setCompleteDialogOpen
  );

  if (!showSticky) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky top-18 z-1 mb-20 lg:top-2",
        hidden && "pointer-events-none"
      )}
      ref={anchorRef}
    >
      <motion.div
        animate={hidden ? "hidden" : "visible"}
        className="flex flex-col rounded-xl border bg-card p-2 shadow-sm"
        transition={{ ease: "easeOut" }}
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: "-120%", opacity: 0 },
        }}
      >
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
      </motion.div>
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
    <Button
      className="w-full sm:w-auto"
      disabled={isActionPending}
      onClick={startPart}
      type="button"
    >
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
  const status = useTryoutPart((state) => state.state.status);
  const goToSet = useTryoutPart((state) => state.actions.goToSet);

  if (isRuntimePending) {
    return null;
  }

  switch (status) {
    case "completed":
    case "ended":
    case "locked":
      break;
    default:
      return null;
  }

  return (
    <Button className="w-full sm:w-auto" onClick={goToSet} type="button">
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
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
