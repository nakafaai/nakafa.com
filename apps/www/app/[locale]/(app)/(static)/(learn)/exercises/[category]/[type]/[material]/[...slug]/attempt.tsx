"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "motion/react";
import { Countdown } from "@/components/exercise/attempt-countdown";
import { ExerciseStats } from "@/components/exercise/attempt-stats";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExerciseTimer } from "@/lib/hooks/use-exercise-timer";
import { useStickyVisibility } from "@/lib/hooks/use-sticky-visibility";
import { CompleteExerciseButton } from "./attempt-complete-button";
import { StartExerciseButton } from "./attempt-start-button";

interface Props {
  totalExercises: number;
}

export function ExerciseAttempt({ totalExercises }: Props) {
  const attempt = useAttempt((state) => state.attempt);
  const completeAttempt = useMutation(api.exercises.mutations.completeAttempt);
  const { hidden } = useStickyVisibility();

  const timer = useExerciseTimer({
    attempt,
    onExpire: async () => {
      if (attempt) {
        try {
          await completeAttempt({ attemptId: attempt._id });
        } catch {
          // Ignore error
        }
      }
    },
  });

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

          {timer.isActive ? (
            <CompleteExerciseButton />
          ) : (
            <StartExerciseButton totalExercises={totalExercises} />
          )}
        </div>

        <ExerciseStats />
      </motion.div>
    </div>
  );
}
