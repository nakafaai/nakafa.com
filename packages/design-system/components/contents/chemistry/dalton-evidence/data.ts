import type { ReactNode } from "react";

export const CONSERVATION_MODE_ID = "conservation";
export const FIXED_MODE_ID = "fixed";
export const MULTIPLE_MODE_ID = "multiple";

export const DALTON_MODE_IDS = [
  CONSERVATION_MODE_ID,
  FIXED_MODE_ID,
  MULTIPLE_MODE_ID,
] as const;

export type DaltonModeId = (typeof DALTON_MODE_IDS)[number];
export type AtomSymbol = "C" | "H" | "O";

export interface Atom {
  id: string;
  symbol: AtomSymbol;
}

export interface Molecule {
  atoms: readonly Atom[];
  id: string;
  label: string;
}

export interface DaltonFact {
  label: string;
  value: string;
}

export interface DaltonModeLabels {
  afterTitle: string;
  beforeTitle: string;
  expression: string;
  facts: readonly DaltonFact[];
  tab: string;
}

export interface DaltonEvidenceLabLabels {
  chooseMode: string;
  modes: Record<DaltonModeId, DaltonModeLabels>;
}

export interface DaltonEvidenceLabProps {
  description: ReactNode;
  labels: DaltonEvidenceLabLabels;
  title: ReactNode;
}

function molecule(
  id: string,
  label: string,
  atomSymbols: readonly AtomSymbol[]
): Molecule {
  const atoms = atomSymbols.map((symbol, index) => ({
    id: `${id}-${symbol.toLowerCase()}-${index + 1}`,
    symbol,
  }));

  return { atoms, id, label };
}

export const DALTON_LAYOUTS = {
  [CONSERVATION_MODE_ID]: {
    before: [
      molecule("co-left", "\\mathrm{CO}", ["C", "O"]),
      molecule("co-right", "\\mathrm{CO}", ["C", "O"]),
      molecule("oxygen", "\\mathrm{O_2}", ["O", "O"]),
    ],
    after: [
      molecule("carbon-dioxide-left", "\\mathrm{CO_2}", ["C", "O", "O"]),
      molecule("carbon-dioxide-right", "\\mathrm{CO_2}", ["C", "O", "O"]),
    ],
  },
  [FIXED_MODE_ID]: {
    before: [
      molecule("water-small-left", "\\mathrm{H_2O}", ["H", "H", "O"]),
      molecule("water-small-right", "\\mathrm{H_2O}", ["H", "H", "O"]),
    ],
    after: [
      molecule("water-large-left", "\\mathrm{H_2O}", ["H", "H", "O"]),
      molecule("water-large-center", "\\mathrm{H_2O}", ["H", "H", "O"]),
      molecule("water-large-right", "\\mathrm{H_2O}", ["H", "H", "O"]),
    ],
  },
  [MULTIPLE_MODE_ID]: {
    before: [
      molecule("monoxide-left", "\\mathrm{CO}", ["C", "O"]),
      molecule("monoxide-right", "\\mathrm{CO}", ["C", "O"]),
    ],
    after: [
      molecule("dioxide-left", "\\mathrm{CO_2}", ["C", "O", "O"]),
      molecule("dioxide-right", "\\mathrm{CO_2}", ["C", "O", "O"]),
    ],
  },
} satisfies Record<
  DaltonModeId,
  { after: readonly Molecule[]; before: readonly Molecule[] }
>;

/**
 * Narrows ToggleGroup string values to the available Dalton evidence modes.
 */
export function isDaltonModeId(value: string): value is DaltonModeId {
  return value in DALTON_LAYOUTS;
}
