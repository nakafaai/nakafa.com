import { useInterval } from "@mantine/hooks";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";

export interface UseExerciseTimerProps {
  attempt: Doc<"exerciseAttempts"> | null;
  expiresAtMs?: number;
  nowMs?: number;
  onExpire?: () => void | Promise<void>;
}

export interface UseExerciseTimerReturn {
  formatted: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  isActive: boolean;
  isExpired: boolean;
}

const UPDATE_INTERVAL_MS = 1000;

/**
 * Calculates the remaining time in seconds for an exercise attempt.
 * @param attempt - The exercise attempt document containing timing information
 * @param nowMs - The current timestamp in milliseconds
 * @returns Remaining seconds (rounded up), or 0 if expired
 */
function calculateRemainingTime(
  attempt: Doc<"exerciseAttempts">,
  nowMs: number,
  expiresAtMs?: number
): number {
  const timeLimitSeconds = attempt.timeLimit;

  if (timeLimitSeconds <= 0) {
    return 0;
  }

  const attemptExpiresAtMs = attempt.startedAt + timeLimitSeconds * 1000;
  const effectiveExpiresAtMs =
    expiresAtMs === undefined
      ? attemptExpiresAtMs
      : Math.min(attemptExpiresAtMs, expiresAtMs);
  const remainingMs = effectiveExpiresAtMs - nowMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Formats seconds into a structured time representation.
 * @param seconds - Total seconds
 * @returns Numeric values plus commonly used string formats
 */
function formatTime(seconds: number): UseExerciseTimerReturn["formatted"] {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return {
    hours,
    minutes,
    seconds: secs,
  };
}

/**
 * Exercise countdown timer.
 * @param attempt - Exercise attempt to track (or null to disable)
 * @param onExpire - Called once when the attempt hits 0 seconds
 * @returns Countdown state and formatted time values
 */
export function useExerciseTimer({
  attempt,
  expiresAtMs,
  nowMs,
  onExpire,
}: UseExerciseTimerProps): UseExerciseTimerReturn {
  const [localNowMs, setLocalNowMs] = useState(Date.now);
  const [hasHandledExpiry, setHasHandledExpiry] = useState(false);
  const currentNowMs = nowMs ?? localNowMs;
  const usesInternalClock = nowMs === undefined;

  const isTimed = attempt?.timeLimit !== undefined && attempt.timeLimit > 0;

  const isInProgress = isTimed && attempt.status === "in-progress";

  const remainingSeconds =
    attempt && isInProgress
      ? calculateRemainingTime(attempt, currentNowMs, expiresAtMs)
      : 0;

  const isActive = isInProgress && remainingSeconds > 0;
  const isExpired = isInProgress && remainingSeconds === 0;

  const interval = useInterval(() => {
    if (!(isActive && attempt)) {
      return;
    }

    const now = Date.now();
    setLocalNowMs(now);

    const remaining = calculateRemainingTime(attempt, now, expiresAtMs);

    if (remaining === 0 && !hasHandledExpiry) {
      setHasHandledExpiry(true);
      onExpire?.();
    }
  }, UPDATE_INTERVAL_MS);

  useEffect(() => {
    if (!hasHandledExpiry || isExpired) {
      return;
    }

    setHasHandledExpiry(false);
  }, [hasHandledExpiry, isExpired]);

  useEffect(() => {
    if (!isExpired || hasHandledExpiry) {
      return;
    }

    setHasHandledExpiry(true);
    onExpire?.();
  }, [hasHandledExpiry, isExpired, onExpire]);

  useEffect(() => {
    if (!(usesInternalClock && isActive)) {
      interval.stop();
      return;
    }

    interval.start();

    return () => {
      interval.stop();
    };
  }, [isActive, interval, usesInternalClock]);

  const formatted = useMemo(
    () => formatTime(remainingSeconds),
    [remainingSeconds]
  );

  return {
    isActive,
    isExpired,
    formatted,
  };
}
