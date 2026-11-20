import { useRequired } from "@repo/design-system/hooks/required";
import type { RefObject } from "react";
import { createContext } from "react";

/**
 * What every moving part of the experiment reads while it draws: the bath's
 * temperature in °C, the glucose solution's strength in per cent, the minutes
 * of the run the card shows, the run's clock in minutes read every frame, the
 * seconds that have really passed while playing, by which a bubble keeps its
 * true pace, and the words written beside the parts.
 */
export const RunContext = createContext<{
  readonly celsius: number;
  readonly clock: RefObject<number>;
  readonly elapsed: number;
  readonly percent: number;
  readonly seconds: RefObject<number>;
  readonly words: {
    readonly bath: string;
    readonly control: string;
    readonly limewater: string;
    readonly paraffin: string;
    readonly thermometer: string;
    readonly yeast: string;
  };
} | null>(null);

/** Reads the run of the experiment the part belongs to. */
export function useRun() {
  return useRequired(RunContext, "useRun");
}
