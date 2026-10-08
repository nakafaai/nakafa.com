"use client";

import { DateTime, MutableHashSet } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useSyncExternalStore,
} from "react";

const InitialClock = createContext<number | null>(null);

/** Transfers the request timestamp unchanged through server rendering and hydration. */
export function TryoutClockProvider({
  children,
  initialNow,
}: {
  children: ReactNode;
  initialNow: number;
}) {
  return <InitialClock value={initialNow}>{children}</InitialClock>;
}

const TICK_MS = 1000;

let currentNow = 0;
let timer: number | null = null;
const listeners = MutableHashSet.empty<() => void>();

/** Returns a shared realtime clock for active try-out timer UI. */
export function useTryoutClock(active: boolean) {
  const initialNow = use(InitialClock);
  if (initialNow === null) {
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
  MutableHashSet.add(listeners, listener);
  startClock();

  return () => {
    MutableHashSet.remove(listeners, listener);
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
    currentNow = readEpochMillis();
  }

  return currentNow;
}

/** Starts the shared clock when the first timer subscribes. */
function startClock() {
  if (timer) {
    return;
  }

  currentNow = readEpochMillis();
  timer = window.setInterval(() => {
    currentNow = readEpochMillis();

    for (const listener of listeners) {
      listener();
    }
  }, TICK_MS);
}

/** Stops the shared clock when no timer UI is mounted. */
function stopClockIfIdle() {
  if (MutableHashSet.size(listeners) > 0 || !timer) {
    return;
  }

  window.clearInterval(timer);
  timer = null;
  currentNow = 0;
}

/** Reads the browser clock synchronously for snapshots and timer ticks. */
function readEpochMillis() {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}
