"use client";

import { StopIcon, Timer02Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { Progress } from "@repo/design-system/components/ui/progress";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import type { TryoutSectionRuntime } from "@/components/tryout/types";
import { useStickyVisibility } from "@/lib/hooks/use-sticky-visibility";

interface TryoutRuntimeControlsProps {
  isExpired: boolean;
  remainingSeconds: number;
  returnHref: string;
  runtime: TryoutSectionRuntime;
}

/** Renders the production sticky timer, progress, and finish controls. */
export function TryoutRuntimeControls({
  isExpired,
  remainingSeconds,
  returnHref,
  runtime,
}: TryoutRuntimeControlsProps) {
  const router = useRouter();
  const completeSection = useMutation(api.tryouts.mutations.sections.complete);
  const tExercises = useTranslations("Exercises");
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();
  const [isOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const { hidden } = useStickyVisibility();
  const progress = getProgress(runtime);
  const isBusy = isPending || isExpired;

  /** Completes the current section through Convex and returns to the set page. */
  function onComplete() {
    if (isBusy) {
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            completeSection({
              attemptId: runtime.attemptId,
              sectionKey: runtime.section.sectionKey,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              closeDialog();
              router.push(returnHref);
              toast.success(tTryouts("complete-part-success"), {
                position: "bottom-center",
              });
            })
          ),
          Effect.catchAll(() =>
            Effect.sync(() => {
              toast.error(tTryouts("complete-part-error"), {
                position: "bottom-center",
              });
            })
          )
        )
      );
    });
  }

  return (
    <>
      <div
        className={cn(
          "sticky top-18 z-1 mb-20 lg:top-2",
          hidden && "pointer-events-none"
        )}
      >
        <LazyMotion features={domAnimation} strict>
          <m.div
            animate={hidden ? "hidden" : "visible"}
            className="flex flex-col rounded-xl border bg-card p-2 shadow-sm"
            transition={{ ease: "easeOut" }}
            variants={{
              hidden: { y: "-120%", opacity: 0 },
              visible: { y: 0, opacity: 1 },
            }}
          >
            <div className="flex items-center justify-between">
              <Countdown seconds={remainingSeconds} />

              <Button
                disabled={isBusy}
                onClick={openDialog}
                type="button"
                variant="destructive"
              >
                <Spinner icon={StopIcon} isLoading={isPending} />
                {tTryouts("complete-part-cta")}
              </Button>
            </div>

            <div className="pt-2">
              <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="default-subtle">
                    <HugeIcons icon={Timer02Icon} />
                    {tExercises("simulation")}
                  </Badge>

                  <NumberFormatGroup>
                    <div className="flex items-baseline text-sm tabular-nums">
                      <NumberFormat value={runtime.section.answeredCount} />
                      <span className="mx-2 text-muted-foreground">/</span>
                      <NumberFormat value={runtime.section.totalQuestions} />
                    </div>
                  </NumberFormatGroup>
                </div>
                <Progress value={progress} />
              </div>
            </div>
          </m.div>
        </LazyMotion>
      </div>

      <ResponsiveDialog
        description={tTryouts("complete-part-description")}
        footer={
          <>
            <Button onClick={closeDialog} type="button" variant="outline">
              {tTryouts("cancel-cta")}
            </Button>
            <Button
              disabled={isBusy}
              onClick={onComplete}
              type="button"
              variant="destructive"
            >
              <Spinner icon={StopIcon} isLoading={isPending} />
              {tTryouts("complete-part-cta")}
            </Button>
          </>
        }
        open={isOpen}
        setOpen={(nextOpen) => {
          if (nextOpen) {
            openDialog();
            return;
          }

          closeDialog();
        }}
        title={tTryouts("complete-part-title")}
      />
    </>
  );
}

/** Renders the attempt timer as stable tabular text. */
function Countdown({ seconds }: { seconds: number }) {
  const formatted = formatTime(seconds);

  return (
    <div className="pl-2">
      <time className="font-mono text-lg tabular-nums">
        {formatted.hours}:{formatted.minutes}:{formatted.seconds}
      </time>
    </div>
  );
}

/** Calculates answered-question progress without hiding divide-by-zero cases. */
function getProgress(runtime: TryoutSectionRuntime) {
  if (runtime.section.totalQuestions === 0) {
    return 0;
  }

  return (runtime.section.answeredCount / runtime.section.totalQuestions) * 100;
}

/** Formats seconds into fixed-width timer segments. */
function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return { hours, minutes, seconds };
}
