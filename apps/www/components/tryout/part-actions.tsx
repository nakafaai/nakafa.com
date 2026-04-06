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
import type { Dispatch, SetStateAction } from "react";
import { Countdown } from "@/components/exercise/attempt-countdown";
import { ExerciseStats } from "@/components/exercise/attempt-stats";
import { useTryoutPart } from "@/components/tryout/providers/part-state";
import { useStickyVisibility } from "@/lib/hooks/use-sticky-visibility";

type TryoutPartDialogSetter = Dispatch<SetStateAction<boolean>>;

/** Renders the sticky countdown and completion controls for an active part. */
export function TryoutPartSticky({
  setCompleteDialogOpenAction,
}: {
  setCompleteDialogOpenAction: TryoutPartDialogSetter;
}) {
  const tTryouts = useTranslations("Tryouts");
  const showSticky = useTryoutPart(
    (state) => state.state.status === "in-progress"
  );
  const isAwaitingExpiry = useTryoutPart(
    (state) => state.state.isAwaitingExpiry
  );
  const timer = useTryoutPart((state) => state.state.timer);
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const { hidden } = useStickyVisibility();

  if (!showSticky) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky top-18 z-1 mb-20 lg:top-2",
        hidden && "pointer-events-none"
      )}
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
            disabled={isAwaitingExpiry || isActionPending}
            onClick={() => setCompleteDialogOpenAction(true)}
            type="button"
            variant="destructive"
          >
            <Spinner
              icon={StopIcon}
              isLoading={isAwaitingExpiry || isActionPending}
            />
            {isAwaitingExpiry
              ? tTryouts("part-processing-expiry-cta")
              : tTryouts("complete-part-cta")}
          </Button>
        </div>

        <ExerciseStats />

        {isAwaitingExpiry ? (
          <p className="px-2 pt-2 text-muted-foreground text-sm">
            {tTryouts("part-head-processing-expiry")}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

/** Renders the primary CTA for starting the current part attempt. */
export function TryoutPartStartCta() {
  const tTryouts = useTranslations("Tryouts");
  const canStartPart = useTryoutPart((state) => state.state.canStartPart);
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const startPart = useTryoutPart((state) => state.actions.startPart);

  if (!canStartPart) {
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

/** Renders the CTA that returns the student to the set overview. */
export function TryoutPartBackCta() {
  const tTryouts = useTranslations("Tryouts");
  const status = useTryoutPart((state) => state.state.status);
  const goToSet = useTryoutPart((state) => state.actions.goToSet);

  switch (status) {
    case "completed":
    case "ended":
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

/** Renders the confirmation dialog for completing the current part. */
export function TryoutPartDialog({
  isCompleteDialogOpen,
  setCompleteDialogOpenAction,
}: {
  isCompleteDialogOpen: boolean;
  setCompleteDialogOpenAction: TryoutPartDialogSetter;
}) {
  const tTryouts = useTranslations("Tryouts");
  const isAwaitingExpiry = useTryoutPart(
    (state) => state.state.isAwaitingExpiry
  );
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const completePart = useTryoutPart((state) => state.actions.completePart);

  return (
    <ResponsiveDialog
      description={
        isAwaitingExpiry
          ? tTryouts("part-head-processing-expiry")
          : tTryouts("complete-part-description")
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setCompleteDialogOpenAction(false)}
            type="button"
            variant="outline"
          >
            {tTryouts("cancel-cta")}
          </Button>
          <Button
            disabled={isAwaitingExpiry || isActionPending}
            onClick={completePart}
            type="button"
            variant="destructive"
          >
            <Spinner
              icon={StopIcon}
              isLoading={isAwaitingExpiry || isActionPending}
            />
            {isAwaitingExpiry
              ? tTryouts("part-processing-expiry-cta")
              : tTryouts("complete-part-cta")}
          </Button>
        </div>
      }
      open={isCompleteDialogOpen}
      setOpen={setCompleteDialogOpenAction}
      title={
        isAwaitingExpiry
          ? tTryouts("part-processing-expiry-title")
          : tTryouts("complete-part-title")
      }
    />
  );
}
