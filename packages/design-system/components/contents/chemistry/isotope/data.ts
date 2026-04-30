import type { ReactNode } from "react";

export const HYDROGEN_1_ID = "hydrogen-1";
export const DEUTERIUM_ID = "deuterium";
export const TRITIUM_ID = "tritium";
export const CARBON_12_ID = "carbon-12";
export const CARBON_13_ID = "carbon-13";
export const CARBON_14_ID = "carbon-14";

export type IsotopeSampleId =
  | typeof HYDROGEN_1_ID
  | typeof DEUTERIUM_ID
  | typeof TRITIUM_ID
  | typeof CARBON_12_ID
  | typeof CARBON_13_ID
  | typeof CARBON_14_ID;

export const ISOTOPE_SAMPLE_IDS = [
  HYDROGEN_1_ID,
  DEUTERIUM_ID,
  TRITIUM_ID,
  CARBON_12_ID,
  CARBON_13_ID,
  CARBON_14_ID,
] satisfies IsotopeSampleId[];

export const ISOTOPE_SAMPLES = {
  [HYDROGEN_1_ID]: {
    atomicNumber: 1,
    massNumber: 1,
    symbol: "H",
  },
  [DEUTERIUM_ID]: {
    atomicNumber: 1,
    massNumber: 2,
    symbol: "H",
  },
  [TRITIUM_ID]: {
    atomicNumber: 1,
    massNumber: 3,
    symbol: "H",
  },
  [CARBON_12_ID]: {
    atomicNumber: 6,
    massNumber: 12,
    symbol: "C",
  },
  [CARBON_13_ID]: {
    atomicNumber: 6,
    massNumber: 13,
    symbol: "C",
  },
  [CARBON_14_ID]: {
    atomicNumber: 6,
    massNumber: 14,
    symbol: "C",
  },
} satisfies Record<
  IsotopeSampleId,
  {
    atomicNumber: number;
    massNumber: number;
    symbol: string;
  }
>;

export interface IsotopeSampleLabels {
  abundance: ReactNode;
  ariaName: string;
  name: ReactNode;
  note: ReactNode;
  tab: ReactNode;
}

export interface IsotopeLabLabels {
  abundance: string;
  atomicNumber: string;
  chooseIsotope: string;
  electrons: string;
  massNumber: string;
  neutrons: string;
  protons: string;
  samples: Record<IsotopeSampleId, IsotopeSampleLabels>;
}

export interface IsotopeLabProps {
  description: ReactNode;
  labels: IsotopeLabLabels;
  title: ReactNode;
}

/**
 * Narrows ToggleGroup string values to the available isotope examples.
 */
export function isIsotopeSampleId(value: string): value is IsotopeSampleId {
  return ISOTOPE_SAMPLE_IDS.some((sampleId) => sampleId === value);
}
