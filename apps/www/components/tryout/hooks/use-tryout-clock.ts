"use client";

import { useSyncExternalStore } from "react";

const MILLISECONDS_PER_SECOND = 1000;
const DISABLED_NOW_MS = 0;

type Listener = () => void;

const listeners = new Set<Listener>();

let intervalId: number | null = null;
let currentNowMs = DISABLED_NOW_MS;

function emitNowMs() {
  currentNowMs = Date.now();

  for (const listener of listeners) {
    listener();
  }
}

function startClock() {
  if (intervalId !== null || typeof window === "undefined") {
    return;
  }

  emitNowMs();
  intervalId = window.setInterval(emitNowMs, MILLISECONDS_PER_SECOND);
}

function stopClock() {
  if (intervalId === null || typeof window === "undefined") {
    return;
  }

  window.clearInterval(intervalId);
  intervalId = null;
}

function subscribeEnabled(listener: Listener) {
  listeners.add(listener);
  startClock();

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      stopClock();
    }
  };
}

function subscribeDisabled() {
  return () => {
    // No-op while the tryout clock is disabled.
  };
}

function getEnabledSnapshot(initialNowMs: number) {
  return currentNowMs === DISABLED_NOW_MS ? initialNowMs : currentNowMs;
}

function getDisabledSnapshot(initialNowMs: number) {
  return initialNowMs;
}

/** Returns the shared client clock used for expiry-sensitive tryout UI. */
export function useTryoutClock(enabled = true, initialNowMs = DISABLED_NOW_MS) {
  return useSyncExternalStore(
    enabled ? subscribeEnabled : subscribeDisabled,
    () =>
      enabled
        ? getEnabledSnapshot(initialNowMs)
        : getDisabledSnapshot(initialNowMs),
    () => getDisabledSnapshot(initialNowMs)
  );
}
