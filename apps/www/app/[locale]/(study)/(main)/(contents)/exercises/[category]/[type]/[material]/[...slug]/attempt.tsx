"use client";

import { useMediaQuery } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExerciseTimer } from "@/lib/hooks/use-exercise-timer";
import { CompleteExerciseButton } from "./attempt-complete-button";
import { Countdown } from "./attempt-countdown";
import { StartExerciseButton } from "./attempt-start-button";
import { ExerciseStats } from "./attempt-stats";

interface Props {
  totalExercises: number;
}

export function ExerciseAttempt({ totalExercises }: Props) {
  const attempt = useAttempt((state) => state.attempt);
  const completeAttempt = useMutation(api.exercises.mutations.completeAttempt);
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const lastYRef = useRef(0);
  const isMobile = useMediaQuery("(max-width: 1024px)");

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

  useMotionValueEvent(scrollY, "change", (latest) => {
    const currentY = Math.max(0, latest);
    const previousY = Math.max(0, lastYRef.current);
    const diff = currentY - previousY;

    // We use the anchorRef to detect if the element is currently "stuck".
    // When stuck, its rect.top will be approximately equal to the sticky offset.
    // If it's larger, it means we are near the top of the page (natural flow).
    const stickyOffset = isMobile ? 72 : 8;
    const rect = anchorRef.current?.getBoundingClientRect();
    const currentTop = rect?.top ?? stickyOffset;

    // Buffer of 10px to avoid flickering near the boundary
    const isNaturalPos = currentTop > stickyOffset + 10;

    if (isNaturalPos) {
      setHidden(false);
      lastYRef.current = currentY;
      return;
    }

    // Hysteresis: Ignore small scroll deltas
    if (Math.abs(diff) < 5) {
      return;
    }

    if (diff > 0) {
      // Scrolling Down -> Hide
      setHidden(true);
    } else {
      // Scrolling Up -> Show
      setHidden(false);
    }

    lastYRef.current = currentY;
  });

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
