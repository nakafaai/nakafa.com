import { Clock, Effect } from "effect";
import { useSyncExternalStore } from "react";

/** How often the timer reads the device clock, in milliseconds. */
const TICK_MS = 1000;

/** The device time that the last tick read. React reads it as a snapshot, so it changes only on a tick. */
let current = 0;

/** Reads the device time and stores it as the snapshot that the timer shows. */
function tick() {
  current = Effect.runSync(Clock.currentTimeMillis);
}

/** Starts one tick for a timer that is on screen, and stops it when the timer leaves. */
function subscribe(listener: () => void) {
  tick();
  const timer = window.setInterval(() => {
    tick();
    listener();
  }, TICK_MS);
  return () => window.clearInterval(timer);
}

/** The device time at the last tick. */
function snapshot() {
  return current;
}

/** The current device time, refreshed each second while a timer is on screen. */
export function useSittingClock() {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
