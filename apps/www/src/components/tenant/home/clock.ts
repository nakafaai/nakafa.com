import { use } from "react";
import { useSittingClock } from "@/components/exams/sitting/timer";
import { HomePreloadContext } from "@/components/tenant/home/data";

/**
 * The time that the home's countdowns and bars measure from. The first HTML and the hydrated page read the server's
 * time that the loader returned, because the device clock reads nothing until it ticks. Once it ticks, the page
 * follows the device clock, which the sitting timers follow too.
 */
export function useHomeNow(): number {
  const { serverNow } = use(HomePreloadContext);
  const deviceNow = useSittingClock();
  if (serverNow === undefined) {
    throw new Error("The school home reads its server time in its loader.");
  }
  return deviceNow === 0 ? serverNow : deviceNow;
}
