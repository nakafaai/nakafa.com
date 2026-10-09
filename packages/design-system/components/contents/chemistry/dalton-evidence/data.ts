import { Array as Arr, Schema } from "effect";

export const CONSERVATION_MODE_ID = "conservation";
const FIXED_MODE_ID = "fixed";
const MULTIPLE_MODE_ID = "multiple";

export type DaltonModeId =
  | typeof CONSERVATION_MODE_ID
  | typeof FIXED_MODE_ID
  | typeof MULTIPLE_MODE_ID;

export const DALTON_MODE_IDS = [
  CONSERVATION_MODE_ID,
  FIXED_MODE_ID,
  MULTIPLE_MODE_ID,
] satisfies DaltonModeId[];

const AtomSymbolSchema = Schema.Literals(["C", "H", "O"]);
export type AtomSymbol = typeof AtomSymbolSchema.Type;

const AtomSchema = Schema.Struct({
  id: Schema.String,
  symbol: AtomSymbolSchema,
});
export type Atom = typeof AtomSchema.Type;

const MoleculeSchema = Schema.Struct({
  atoms: Schema.Array(AtomSchema),
  id: Schema.String,
  label: Schema.String,
});
export type Molecule = typeof MoleculeSchema.Type;

const DaltonFactSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
});

const DaltonModeLabelsSchema = Schema.Struct({
  afterTitle: Schema.String,
  beforeTitle: Schema.String,
  expression: Schema.String,
  facts: Schema.Array(DaltonFactSchema),
  tab: Schema.String,
});

const DaltonEvidenceLabLabelsSchema = Schema.Struct({
  chooseMode: Schema.String,
  modes: Schema.Record(
    Schema.Literals(DALTON_MODE_IDS),
    DaltonModeLabelsSchema
  ),
});
export type DaltonEvidenceLabLabels = typeof DaltonEvidenceLabLabelsSchema.Type;

function molecule(
  id: string,
  label: string,
  atomSymbols: readonly AtomSymbol[]
): Molecule {
  const atoms = Arr.map(atomSymbols, (symbol, index) => ({
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
