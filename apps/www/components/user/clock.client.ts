"use client";

import { DateTime } from "effect";
import { useEffect, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import { AGE_TICK_MILLISECONDS } from "@/components/user/age";
import { type AgeClock, createAgeClock } from "@/components/user/clock";

/**
 * The clock of one list's ages, created once for the list. It starts at
 * `startAt`, moves to the browser's time at once, and then every minute, so an
 * age keeps up with the time on every tab of the profile.
 */
export function useAgeClock(startAt: number) {
  const [clock] = useState(() => createAgeClock(startAt));

  useEffect(() => {
    const tick = () =>
      clock.getState().setNow(DateTime.toEpochMillis(DateTime.nowUnsafe()));
    tick();
    const timer = window.setInterval(tick, AGE_TICK_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, [clock]);

  return clock;
}

/** The moment a row's age counts from, so only the rows re-render on each tick. */
export function useAgeNow(clock: StoreApi<AgeClock>) {
  return useStore(clock, (state) => state.now);
}
