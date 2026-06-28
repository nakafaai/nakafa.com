"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { domAnimation, LazyMotion, m } from "motion/react";
import { CompleteExerciseButton } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/complete";
import type { PracticeRouteData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { StartExerciseButton } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/start";
import { Countdown } from "@/components/exercise/attempt-countdown";
import { ExerciseStats } from "@/components/exercise/attempt-stats";
import { reportClientException } from "@/lib/analytics/client";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExerciseTimer } from "@/lib/hooks/use-exercise-timer";
import { useStickyVisibility } from "@/lib/hooks/use-sticky-visibility";

/**
 * Renders the sticky attempt controls for a restored practice set route.
 *
 * The slug comes from `ExerciseContextProvider`, so the new public URL can keep
 * using localized route segments while attempts remain keyed by the stable
 * source set slug.
 */
export function ExerciseAttempt({
  totalExercises,
}: {
  totalExercises: Extract<
    PracticeRouteData,
    { kind: "set" }
  >["exercises"]["length"];
}) {
  const attempt = useAttempt((state) => state.attempt);
  const completeAttempt = useMutation(api.exercises.mutations.completeAttempt);
  const { hidden } = useStickyVisibility();

  const timer = useExerciseTimer({
    attempt,
    onExpire: async () => {
      if (!attempt) {
        return;
      }

      await Effect.runPromise(
        Effect.tryPromise({
          try: () => completeAttempt({ attemptId: attempt._id }),
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "exercise-expire-attempt",
            })
          )
        )
      );
    },
  });

  return (
    <div
      className={cn(
        "sticky top-18 z-1 mb-20 lg:top-2",
        hidden && "pointer-events-none"
      )}
      data-markdown-ignore
    >
      <LazyMotion features={domAnimation} strict>
        <m.div
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
            {timer.isActive ? (
              <CompleteExerciseButton />
            ) : (
              <StartExerciseButton totalExercises={totalExercises} />
            )}
          </div>
          <ExerciseStats />
        </m.div>
      </LazyMotion>
    </div>
  );
}
