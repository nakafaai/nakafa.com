"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 1000;

let currentNow = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

/** Returns a shared realtime clock for active try-out timer UI. */
export function useTryoutClock(active: boolean) {
  return useSyncExternalStore(
    active ? subscribe : emptySubscribe,
    active ? getSnapshot : getStaticSnapshot,
    getStaticSnapshot
  );
}

/** Subscribes one timer UI to the shared one-second browser clock. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  startClock();

  return () => {
    listeners.delete(listener);
    stopClockIfIdle();
  };
}

/** Keeps static UI from subscribing to the ticking clock. */
function emptySubscribe() {
  return noop;
}

/** No-op unsubscribe for inactive timer subscribers. */
function noop() {
  return;
}

/** Returns the current browser timestamp for active timer subscribers. */
function getSnapshot() {
  return getCurrentNow();
}

/** Returns a stable timestamp for inactive timer UI. */
function getStaticSnapshot() {
  return getCurrentNow();
}

/** Lazily initializes the shared timestamp. */
function getCurrentNow() {
  if (currentNow === 0) {
    currentNow = Date.now();
  }

  return currentNow;
}

/** Starts the shared clock when the first timer subscribes. */
function startClock() {
  if (timer) {
    return;
  }

  currentNow = Date.now();
  timer = window.setInterval(() => {
    currentNow = Date.now();

    for (const listener of listeners) {
      listener();
    }
  }, TICK_MS);
}

/** Stops the shared clock when no timer UI is mounted. */
function stopClockIfIdle() {
  if (listeners.size > 0 || !timer) {
    return;
  }

  window.clearInterval(timer);
  timer = null;
}
