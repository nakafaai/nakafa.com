import {
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import type { ParabolicMotionState } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import type { ReactNode } from "react";

/** The names of the four readings that a launch's footer shows. */
export interface ParabolicFactLabels {
  flightTime: ReactNode;
  initialSpeed: ReactNode;
  peakHeight: ReactNode;
  range: ReactNode;
}

/**
 * The four readings of one launch in footer order: each one's label and its
 * math. A lab and the static card that holds its place both draw these, so the
 * math of a launch has one owner.
 */
export function getParabolicFacts(
  motion: ParabolicMotionState,
  decimalSeparator: DecimalSeparator | undefined,
  labels: ParabolicFactLabels
) {
  return [
    {
      id: "initial-speed",
      label: labels.initialSpeed,
      math: `v_0=${formatTrimmedSpeedMath(
        motion.scenario.initialSpeed,
        decimalSeparator
      )}`,
    },
    {
      id: "flight-time",
      label: labels.flightTime,
      math: `T=${formatTrimmedSecondMath(motion.flightTime, decimalSeparator)}`,
    },
    {
      id: "range",
      label: labels.range,
      math: `R=${formatTrimmedMeterMath(motion.range, decimalSeparator)}`,
    },
    {
      id: "peak-height",
      label: labels.peakHeight,
      math: `h_{\\max}=${formatTrimmedMeterMath(motion.peakHeight, decimalSeparator)}`,
    },
  ];
}
