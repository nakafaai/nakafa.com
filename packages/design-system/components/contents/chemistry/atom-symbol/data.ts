import type { ReactNode } from "react";

export const CARBON_12_ID = "carbon-12";
export const OXYGEN_16_ID = "oxygen-16";
export const SODIUM_23_ID = "sodium-23";
export const CHLORINE_35_ID = "chlorine-35";

export type AtomSymbolSampleId =
  | typeof CARBON_12_ID
  | typeof OXYGEN_16_ID
  | typeof SODIUM_23_ID
  | typeof CHLORINE_35_ID;

export const ATOM_SYMBOL_SAMPLE_IDS = [
  CARBON_12_ID,
  OXYGEN_16_ID,
  SODIUM_23_ID,
  CHLORINE_35_ID,
] satisfies AtomSymbolSampleId[];

export const ATOM_SYMBOL_SAMPLES = {
  [CARBON_12_ID]: {
    atomicNumber: 6,
    massNumber: 12,
    symbol: "C",
  },
  [OXYGEN_16_ID]: {
    atomicNumber: 8,
    massNumber: 16,
    symbol: "O",
  },
  [SODIUM_23_ID]: {
    atomicNumber: 11,
    massNumber: 23,
    symbol: "Na",
  },
  [CHLORINE_35_ID]: {
    atomicNumber: 17,
    massNumber: 35,
    symbol: "Cl",
  },
} satisfies Record<
  AtomSymbolSampleId,
  {
    atomicNumber: number;
    massNumber: number;
    symbol: string;
  }
>;

export interface AtomSymbolSampleLabels {
  ariaName: string;
  name: ReactNode;
  tab: ReactNode;
}

export interface AtomSymbolLabLabels {
  atomicNumber: string;
  chooseAtom: string;
  electronCount: string;
  elementSymbol: string;
  massNumber: string;
  neutralAtom: string;
  neutronCount: string;
  protonCount: string;
  samples: Record<AtomSymbolSampleId, AtomSymbolSampleLabels>;
}

export interface AtomSymbolLabProps {
  description: ReactNode;
  labels: AtomSymbolLabLabels;
  title: ReactNode;
}

/**
 * Narrows ToggleGroup string values to available atom-symbol samples.
 */
export function isAtomSymbolSampleId(
  value: string
): value is AtomSymbolSampleId {
  return ATOM_SYMBOL_SAMPLE_IDS.some((sampleId) => sampleId === value);
}
