import { Clock, Effect } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useSittingClock } from "@/components/exams/sitting/timer";
import {
  anchorAt,
  type HomeAnchor,
  homeTime,
} from "@/components/tenant/home/anchor";

/**
 * The anchor of the home's time. Outside a `HomeClock` the anchor is the epoch, so a cell that misses its provider
 * shows that at once instead of a time that looks right.
 */
const HomeClockContext = createContext<HomeAnchor>({
  deviceNow: 0,
  serverNow: 0,
});

/**
 * Anchors the home's time at the server's time that the loader returned, at the device's time of the first render. The
 * anchor is created once for each server time, and its value does not change after that, so the streamed cells keep
 * their hydration.
 */
export function HomeClock({
  children,
  serverNow,
}: {
  children: ReactNode;
  /** The server's time that the loader returned, which the home's countdowns and bars start from. */
  serverNow: number;
}) {
  const [anchor] = useState(() =>
    anchorAt(serverNow, Effect.runSync(Clock.currentTimeMillis))
  );

  return <HomeClockContext value={anchor}>{children}</HomeClockContext>;
}

/**
 * The time that a home's countdowns and bars measure from. The first HTML and the first render read the server's time,
 * because the device clock reads nothing until it ticks. Once it ticks, the home moves on from the server's time by
 * the time the device has counted since its anchor, so the countdowns agree with the server from the first paint and a
 * device clock that is wrong does not move them.
 */
export function useHomeNow(): number {
  const anchor = use(HomeClockContext);
  const deviceNow = useSittingClock();
  return deviceNow === 0 ? anchor.serverNow : homeTime(anchor, deviceNow);
}
