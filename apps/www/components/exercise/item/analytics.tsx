"use client";

import { useInterval } from "@mantine/hooks";
import { useEffect, useRef } from "react";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

/** Tracks visible time for one rendered exercise while the active attempt is running. */
export function QuestionAnalytics({
  articleId,
  exerciseNumber,
}: {
  articleId: string;
  exerciseNumber: number;
}) {
  const isInputLocked = useAttempt((state) => state.isInputLocked);
  const isAttemptInProgress = useAttempt((state) => state.isAttemptInProgress);
  const timeSpent = useExercise(
    (state) => state.timeSpent[exerciseNumber] ?? 0
  );
  const isActiveRef = useRef(false);
  const timeCounterRef = useRef(timeSpent);
  const setTimeSpent = useExercise((state) => state.setTimeSpent);
  const hasActiveAttempt = isAttemptInProgress && !isInputLocked;

  useEffect(() => {
    timeCounterRef.current = timeSpent;
  }, [timeSpent]);

  useEffect(() => {
    const target = document.getElementById(articleId);

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isActiveRef.current = entry?.isIntersecting ?? false;
      },
      { threshold: 0.75 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [articleId]);

  const interval = useInterval(() => {
    if (isActiveRef.current && hasActiveAttempt) {
      timeCounterRef.current += 1;
      setTimeSpent(exerciseNumber, timeCounterRef.current);
    }
  }, 1000);

  useEffect(() => {
    if (hasActiveAttempt) {
      interval.start();
      return () => {
        interval.stop();
      };
    }

    interval.stop();
  }, [hasActiveAttempt, interval]);

  return null;
}
