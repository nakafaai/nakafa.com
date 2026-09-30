"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createContext, useContextSelector } from "use-context-selector";

const missingClock = Symbol("missing-tryout-clock");

const InitialClock = createContext<number | typeof missingClock>(missingClock);

/** Transfers the request timestamp unchanged through server rendering and hydration. */
export function TryoutClockProvider({
  children,
  initialNow,
}: {
  children: ReactNode;
  initialNow: number;
}) {
  return (
    <InitialClock.Provider value={initialNow}>{children}</InitialClock.Provider>
  );
}

const TICK_MS = 1000;

let currentNow = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

/** Returns a shared realtime clock for active try-out timer UI. */
export function useTryoutClock(active: boolean) {
  const initialNow = useContextSelector(InitialClock, (value) => value);
  if (initialNow === missingClock) {
    throw new Error("TryoutClockProvider is required for try-out controls.");
  }
  return useSyncExternalStore(
    active ? subscribe : emptySubscribe,
    active ? getSnapshot : getStaticSnapshot,
    () => initialNow
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
  // An inactive clock has no timer to release.
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
  currentNow = 0;
}
