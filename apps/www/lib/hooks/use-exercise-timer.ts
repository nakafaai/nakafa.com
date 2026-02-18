import { useInterval } from "@mantine/hooks";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";

export interface UseExerciseTimerProps {
  attempt: Doc<"exerciseAttempts"> | null;
  onExpire?: () => void | Promise<void>;
}

export interface UseExerciseTimerReturn {
  formatted: {
    hours: number;
    minutes: number;
    seconds: number;
    hh: string;
    mm: string;
    ss: string;
    hms: string;
    ms: string;
  };
  isActive: boolean;
  isExpired: boolean;
  isLowTime: boolean;
  progress: number;
  remainingSeconds: number;
  totalSeconds: number;
}

const LOW_TIME_THRESHOLD_SECONDS = 60;
const UPDATE_INTERVAL_MS = 1000;

/**
 * Formats a time unit as a zero-padded string.
 * @param value - The numeric time unit (hours, minutes, seconds)
 * @returns The time unit formatted as two digits
 */
function formatTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Calculates the remaining time in seconds for an exercise attempt.
 * @param attempt - The exercise attempt document containing timing information
 * @param nowMs - The current timestamp in milliseconds
 * @returns Remaining seconds (rounded up), or 0 if expired
 */
function calculateRemainingTime(
  attempt: Doc<"exerciseAttempts">,
  nowMs: number
): number {
  const timeLimitSeconds = attempt.timeLimit;

  if (timeLimitSeconds <= 0) {
    return 0;
  }

  const expiresAtMs = attempt.startedAt + timeLimitSeconds * 1000;
  const remainingMs = expiresAtMs - nowMs;
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
    hh: formatTimePart(hours),
    mm: formatTimePart(minutes),
    ss: formatTimePart(secs),
    hms: `${formatTimePart(hours)}:${formatTimePart(minutes)}:${formatTimePart(secs)}`,
    ms: `${formatTimePart(minutes)}:${formatTimePart(secs)}`,
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
  onExpire,
}: UseExerciseTimerProps): UseExerciseTimerReturn {
  const [nowMs, setNowMs] = useState(Date.now);
  const [hasExpired, setHasExpired] = useState(false);

  const isTimed = attempt?.timeLimit !== undefined && attempt.timeLimit > 0;

  const isInProgress = isTimed && attempt.status === "in-progress";

  const remainingSeconds =
    attempt && isInProgress ? calculateRemainingTime(attempt, nowMs) : 0;

  const totalSeconds = isTimed ? attempt.timeLimit : 0;

  const isActive = isInProgress && remainingSeconds > 0;

  const isExpired =
    isTimed &&
    (attempt.status === "expired" || (isInProgress && remainingSeconds === 0));

  const isLowTime =
    remainingSeconds > 0 && remainingSeconds <= LOW_TIME_THRESHOLD_SECONDS;

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;

  const interval = useInterval(() => {
    if (!(isActive && attempt)) {
      return;
    }

    const now = Date.now();
    setNowMs(now);

    const remaining = calculateRemainingTime(attempt, now);

    if (remaining === 0 && !hasExpired) {
      setHasExpired(true);
      onExpire?.();
    }
  }, UPDATE_INTERVAL_MS);

  useEffect(() => {
    if (!isActive) {
      interval.stop();
      return;
    }

    interval.start();

    return () => {
      interval.stop();
    };
  }, [isActive, interval]);

  const formatted = useMemo(
    () => formatTime(remainingSeconds),
    [remainingSeconds]
  );

  return {
    remainingSeconds,
    totalSeconds,
    progress,
    isActive,
    isExpired,
    isLowTime,
    formatted,
  };
}
