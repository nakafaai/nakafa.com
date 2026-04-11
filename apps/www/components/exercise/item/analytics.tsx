"use client";

import { useInterval } from "@mantine/hooks";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

/** Tracks visible time for one rendered exercise while the active attempt is running. */
export function QuestionAnalytics({
  exerciseNumber,
  targetId,
}: {
  exerciseNumber: number;
  targetId: string;
}) {
  const isInputLocked = useAttempt((state) => state.isInputLocked);
  const isAttemptInProgress = useAttempt((state) => state.isAttemptInProgress);
  const [isActive, setIsActive] = useState(false);
  const timeSpent = useExercise(
    (state) => state.timeSpent[exerciseNumber] ?? 0
  );
  const timeCounterRef = useRef(timeSpent);
  const setTimeSpent = useExercise((state) => state.setTimeSpent);
  const hasActiveAttempt = isAttemptInProgress && !isInputLocked;

  useEffect(() => {
    timeCounterRef.current = timeSpent;
  }, [timeSpent]);

  useEffect(() => {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(entry?.isIntersecting ?? false);
      },
      { threshold: 0.75 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetId]);

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
      return () => {
        interval.stop();
      };
    }

    interval.stop();
  }, [hasActiveAttempt, interval, isActive]);

  return null;
}
