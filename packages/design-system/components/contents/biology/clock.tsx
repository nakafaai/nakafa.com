import { useCycleClock } from "@repo/design-system/components/contents/simulation/clock";

/**
 * The clock of a lab whose card shows the time on a slider: it runs from 0 to
 * `total` while the card plays, at `perSecond` units a second, holds cleanly at
 * `total` without overshooting, and loops. The card hands the slider's value in
 * as `elapsed` and takes the playing clock back through `onElapsed`, rounded to
 * `steps` steps of the run, so the card re-renders a few times a second at most
 * while the scene reads the exact clock every frame.
 */
export function useRunClock({
  elapsed,
  onElapsed,
  perSecond,
  steps,
  total,
}: {
  readonly elapsed: number;
  readonly onElapsed: (value: number) => void;
  readonly perSecond: number;
  readonly steps: number;
  readonly total: number;
}) {
  return useCycleClock({
    initial: total,
    onValue: onElapsed,
    rate: perSecond,
    steps,
    total,
    value: elapsed,
  });
}
