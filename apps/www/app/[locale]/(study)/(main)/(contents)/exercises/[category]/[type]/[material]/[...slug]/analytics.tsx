"use client";

import { useIntersection, useInterval } from "@mantine/hooks";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef } from "react";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

export function QuestionAnalytics({
  exerciseNumber,
  children,
}: {
  exerciseNumber: number;
  children: ReactNode;
}) {
  const attempt = useAttempt((state) => state.attempt);

  const ref = useIntersection({ threshold: 0.75 });
  const isActive = ref.entry?.isIntersecting ?? false;
  const timeCounterRef = useRef(0);

  const setTimeSpent = useExercise((state) => state.setTimeSpent);

  const hasActiveAttempt = attempt?.status === "in-progress";

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
    } else {
      interval.stop();
    }
  }, [isActive, hasActiveAttempt, interval]);

  return <div ref={ref.ref}>{children}</div>;
}
