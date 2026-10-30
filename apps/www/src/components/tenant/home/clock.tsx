import { Clock, Effect } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useSittingClock } from "@/components/exams/sitting/timer";

/**
 * The time at which the home first rendered. Outside a `HomeClock` it is the epoch, so a cell that misses its
 * provider shows that at once instead of a time that looks right.
 */
const HomeClockContext = createContext(0);

/**
 * Holds the time at which the home first rendered, read once from the device. Its value does not change after
 * that, so the cells below never render again because of it.
 */
export function HomeClock({ children }: { children: ReactNode }) {
  const [startedAt] = useState(() => Effect.runSync(Clock.currentTimeMillis));

  return <HomeClockContext value={startedAt}>{children}</HomeClockContext>;
}

/**
 * The time that a home's countdowns and bars measure from: the time of the home's first render until the device
 * clock ticks, then the device clock, so the first frame already shows every countdown.
 */
export function useHomeNow(): number {
  const startedAt = use(HomeClockContext);
  const deviceNow = useSittingClock();
  return deviceNow === 0 ? startedAt : deviceNow;
}
