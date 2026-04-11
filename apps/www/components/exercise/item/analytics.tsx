"use client";

import { useIntersection, useInterval } from "@mantine/hooks";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef } from "react";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

interface QuestionAnalyticsProps {
  children: ReactNode;
  exerciseNumber: number;
}

/** Tracks visible time for one rendered exercise while the active attempt is running. */
export function QuestionAnalytics({
  children,
  exerciseNumber,
}: QuestionAnalyticsProps) {
  const attempt = useAttempt((state) => state.attempt);
  const isInputLocked = useAttempt((state) => state.isInputLocked);
  const ref = useIntersection({ threshold: 0.75 });
  const isActive = ref.entry?.isIntersecting ?? false;
  const timeSpent = useExercise(
    (state) => state.timeSpent[exerciseNumber] ?? 0
  );
  const timeCounterRef = useRef(timeSpent);
  const setTimeSpent = useExercise((state) => state.setTimeSpent);
  const hasActiveAttempt = attempt?.status === "in-progress" && !isInputLocked;

  const handleTick = useEffectEvent(() => {
    if (isActive && hasActiveAttempt) {
      timeCounterRef.current += 1;
      setTimeSpent(exerciseNumber, timeCounterRef.current);
    }
  });

  const interval = useInterval(() => {
    handleTick();
  }, 1000);

  useEffect(() => {
    if (isActive && hasActiveAttempt) {
      interval.start();
      return;
    }

    interval.stop();
  }, [hasActiveAttempt, interval, isActive]);

  return <div ref={ref.ref}>{children}</div>;
}
