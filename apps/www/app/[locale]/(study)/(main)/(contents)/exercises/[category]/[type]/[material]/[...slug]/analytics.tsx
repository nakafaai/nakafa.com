"use client";

import {
  useDebouncedCallback,
  useIntersection,
  useInterval,
} from "@mantine/hooks";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useExercise } from "@/lib/context/use-exercise";

export function QuestionAnalytics({
  exerciseNumber,
  children,
}: {
  exerciseNumber: number;
  children: ReactNode;
}) {
  const ref = useIntersection({ threshold: 0.75 });
  const isActive = ref.entry?.isIntersecting ?? false;
  const timeCounterRef = useRef(0);

  const setTimeSpent = useExercise((state) => state.setTimeSpent);

  const debouncedPersist = useDebouncedCallback((time: number) => {
    setTimeSpent(exerciseNumber, time);
  }, 1000);

  const interval = useInterval(() => {
    if (isActive) {
      timeCounterRef.current += 1;
      debouncedPersist(timeCounterRef.current);
    }
  }, 1000);

  useEffect(() => {
    if (isActive) {
      interval.start();
    } else {
      interval.stop();
    }
  }, [isActive, interval]);

  useEffect(() => {
    return () => {
      debouncedPersist.flush();
    };
  }, [debouncedPersist]);

  return <div ref={ref.ref}>{children}</div>;
}
