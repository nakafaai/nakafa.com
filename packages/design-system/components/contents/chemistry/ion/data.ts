import type { ReactNode } from "react";

export const SODIUM_CATION_ID = "sodium-cation";
export const FLUORIDE_ANION_ID = "fluoride-anion";
export const LITHIUM_CATION_ID = "lithium-cation";
export const OXIDE_ANION_ID = "oxide-anion";

export type IonSampleId =
  | typeof SODIUM_CATION_ID
  | typeof FLUORIDE_ANION_ID
  | typeof LITHIUM_CATION_ID
  | typeof OXIDE_ANION_ID;

export const ION_SAMPLE_IDS = [
  SODIUM_CATION_ID,
  FLUORIDE_ANION_ID,
  LITHIUM_CATION_ID,
  OXIDE_ANION_ID,
] satisfies IonSampleId[];

export const ION_SAMPLES = {
  [SODIUM_CATION_ID]: {
    atomicNumber: 11,
    charge: 1,
    massNumber: 23,
    symbol: "Na",
  },
  [FLUORIDE_ANION_ID]: {
    atomicNumber: 9,
    charge: -1,
    massNumber: 19,
    symbol: "F",
  },
  [LITHIUM_CATION_ID]: {
    atomicNumber: 3,
    charge: 1,
    massNumber: 7,
    symbol: "Li",
  },
  [OXIDE_ANION_ID]: {
    atomicNumber: 8,
    charge: -2,
    massNumber: 16,
    symbol: "O",
  },
} satisfies Record<
  IonSampleId,
  {
    atomicNumber: number;
    charge: number;
    massNumber: number;
    symbol: string;
  }
>;

export interface IonSampleLabels {
  action: ReactNode;
  name: string;
  type: string;
}

export interface IonLabLabels {
  afterChange: string;
  beforeChange: string;
  charge: string;
  chooseIon: string;
  electronChange: string;
  electrons: string;
  neutralAtom: string;
  neutrons: string;
  protons: string;
  samples: Record<IonSampleId, IonSampleLabels>;
}

export interface IonLabProps {
  description: ReactNode;
  labels: IonLabLabels;
  title: ReactNode;
}

/**
 * Narrows ToggleGroup string values to the available ion examples.
 */
export function isIonSampleId(value: string): value is IonSampleId {
  return ION_SAMPLE_IDS.some((sampleId) => sampleId === value);
}
