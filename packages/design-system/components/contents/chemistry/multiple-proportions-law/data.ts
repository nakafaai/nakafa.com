import type { getAtomSceneColors } from "@repo/design-system/components/contents/chemistry/color";
import type { ElementName } from "@repo/design-system/components/contents/chemistry/element";
import { ElementNameSchema } from "@repo/design-system/components/contents/chemistry/element";
import { Array as Arr, Schema } from "effect";

export const WATER_PEROXIDE_MODE_ID = "water-peroxide";
const CARBON_OXIDES_MODE_ID = "carbon-oxides";
const NITROGEN_OXIDES_MODE_ID = "nitrogen-oxides";

export const MULTIPLE_PROPORTIONS_MODE_IDS = [
  WATER_PEROXIDE_MODE_ID,
  CARBON_OXIDES_MODE_ID,
  NITROGEN_OXIDES_MODE_ID,
] as const;

export type MultipleProportionsModeId =
  (typeof MULTIPLE_PROPORTIONS_MODE_IDS)[number];

export type MultipleProportionsSceneColors = ReturnType<
  typeof getAtomSceneColors
>;

const MultipleProportionsScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
type MultipleProportionsScenePoint =
  typeof MultipleProportionsScenePointSchema.Type;

const MultipleProportionsAtomSchema = Schema.Struct({
  element: ElementNameSchema,
  id: Schema.String,
  position: MultipleProportionsScenePointSchema,
});
export type MultipleProportionsAtom = typeof MultipleProportionsAtomSchema.Type;

const MultipleProportionsBondOrderSchema = Schema.Literals([1, 2, 3]);

const MultipleProportionsBondSchema = Schema.Tuple([
  Schema.String,
  Schema.String,
  MultipleProportionsBondOrderSchema,
]);

const MultipleProportionsMoleculeSchema = Schema.Struct({
  atoms: Schema.Array(MultipleProportionsAtomSchema),
  bonds: Schema.Array(MultipleProportionsBondSchema),
  id: Schema.String,
  position: MultipleProportionsScenePointSchema,
});
export type MultipleProportionsMolecule =
  typeof MultipleProportionsMoleculeSchema.Type;

const MultipleProportionsCompoundModelSchema = Schema.Struct({
  formula: Schema.String,
  molecules: Schema.Array(MultipleProportionsMoleculeSchema),
  plaqueFormula: Schema.String,
  plaqueSubtitle: Schema.String,
});
export type MultipleProportionsCompoundModel =
  typeof MultipleProportionsCompoundModelSchema.Type;

const MultipleProportionsModeModelSchema = Schema.Struct({
  first: MultipleProportionsCompoundModelSchema,
  ratioText: Schema.String,
  second: MultipleProportionsCompoundModelSchema,
});
type MultipleProportionsModeModel =
  typeof MultipleProportionsModeModelSchema.Type;

export const MULTIPLE_PROPORTIONS_SCENE_VIEW = {
  cameraPosition: [0, 0.29, 0.78],
  cameraTarget: [0, 0.125, 0.02],
  narrowCameraPosition: [0, 0.35, 0.98],
} satisfies Record<string, MultipleProportionsScenePoint>;

export const MULTIPLE_PROPORTIONS_MODELS = {
  [WATER_PEROXIDE_MODE_ID]: {
    first: {
      formula: "\\mathrm{H_2O}",
      molecules: [
        molecule(
          "water",
          [0, 0, 0],
          [
            atom("water-o", "oxygen", [0, 0.008, 0]),
            atom("water-h-left", "hydrogen", [-0.044, -0.019, 0.008]),
            atom("water-h-right", "hydrogen", [0.044, -0.019, -0.008]),
          ]
        ),
      ],
      plaqueFormula: "H₂O",
      plaqueSubtitle: "1 O per 2 H",
    },
    ratioText: "1 : 2",
    second: {
      formula: "\\mathrm{H_2O_2}",
      molecules: [
        molecule(
          "peroxide",
          [0, 0, 0],
          [
            atom("peroxide-o-left", "oxygen", [-0.025, 0.006, 0.008]),
            atom("peroxide-o-right", "oxygen", [0.025, 0.006, -0.008]),
            atom("peroxide-h-left", "hydrogen", [-0.064, -0.018, 0.018]),
            atom("peroxide-h-right", "hydrogen", [0.064, -0.018, -0.018]),
          ],
          [
            ["peroxide-o-left", "peroxide-o-right", 1],
            ["peroxide-o-left", "peroxide-h-left", 1],
            ["peroxide-o-right", "peroxide-h-right", 1],
          ]
        ),
      ],
      plaqueFormula: "H₂O₂",
      plaqueSubtitle: "2 O per 2 H",
    },
  },
  [CARBON_OXIDES_MODE_ID]: {
    first: {
      formula: "\\mathrm{CO}",
      molecules: [
        molecule(
          "carbon-monoxide",
          [0, 0, 0],
          [
            atom("carbon-monoxide-c", "carbon", [-0.024, 0, 0.004]),
            atom("carbon-monoxide-o", "oxygen", [0.026, 0, -0.004]),
          ],
          [["carbon-monoxide-c", "carbon-monoxide-o", 3]]
        ),
      ],
      plaqueFormula: "CO",
      plaqueSubtitle: "1 O per 1 C",
    },
    ratioText: "1 : 2",
    second: {
      formula: "\\mathrm{CO_2}",
      molecules: [
        molecule(
          "carbon-dioxide",
          [0, 0, 0],
          [
            atom("carbon-dioxide-o-left", "oxygen", [-0.052, 0, 0.004]),
            atom("carbon-dioxide-c", "carbon", [0, 0, 0]),
            atom("carbon-dioxide-o-right", "oxygen", [0.052, 0, -0.004]),
          ],
          [
            ["carbon-dioxide-c", "carbon-dioxide-o-left", 2],
            ["carbon-dioxide-c", "carbon-dioxide-o-right", 2],
          ]
        ),
      ],
      plaqueFormula: "CO₂",
      plaqueSubtitle: "2 O per 1 C",
    },
  },
  [NITROGEN_OXIDES_MODE_ID]: {
    first: {
      formula: "2\\mathrm{N_2O}",
      molecules: [
        molecule(
          "nitrous-oxide-top",
          [0, 0.032, 0],
          [
            atom("nitrous-oxide-top-n-left", "nitrogen", [-0.044, 0, 0.006]),
            atom("nitrous-oxide-top-n-right", "nitrogen", [0, 0, 0]),
            atom("nitrous-oxide-top-o", "oxygen", [0.046, 0, -0.006]),
          ],
          [
            ["nitrous-oxide-top-n-left", "nitrous-oxide-top-n-right", 2],
            ["nitrous-oxide-top-n-right", "nitrous-oxide-top-o", 2],
          ]
        ),
        molecule(
          "nitrous-oxide-bottom",
          [0, -0.032, 0],
          [
            atom(
              "nitrous-oxide-bottom-n-left",
              "nitrogen",
              [-0.044, 0, -0.006]
            ),
            atom("nitrous-oxide-bottom-n-right", "nitrogen", [0, 0, 0]),
            atom("nitrous-oxide-bottom-o", "oxygen", [0.046, 0, 0.006]),
          ],
          [
            ["nitrous-oxide-bottom-n-left", "nitrous-oxide-bottom-n-right", 2],
            ["nitrous-oxide-bottom-n-right", "nitrous-oxide-bottom-o", 2],
          ]
        ),
      ],
      plaqueFormula: "2 N₂O",
      plaqueSubtitle: "0.5 O per N",
    },
    ratioText: "1 : 4",
    second: {
      formula: "\\mathrm{NO_2}",
      molecules: [
        molecule(
          "nitrogen-dioxide",
          [0, 0, 0],
          [
            atom("nitrogen-dioxide-o-left", "oxygen", [-0.046, -0.015, 0.008]),
            atom("nitrogen-dioxide-n", "nitrogen", [0, 0.016, 0]),
            atom("nitrogen-dioxide-o-right", "oxygen", [0.046, -0.015, -0.008]),
          ],
          [
            ["nitrogen-dioxide-n", "nitrogen-dioxide-o-left", 2],
            ["nitrogen-dioxide-n", "nitrogen-dioxide-o-right", 1],
          ]
        ),
      ],
      plaqueFormula: "NO₂",
      plaqueSubtitle: "2 O per N",
    },
  },
} satisfies Record<MultipleProportionsModeId, MultipleProportionsModeModel>;

export function isMultipleProportionsModeId(
  value: string
): value is MultipleProportionsModeId {
  return value in MULTIPLE_PROPORTIONS_MODELS;
}

function atom(
  id: string,
  element: ElementName,
  position: MultipleProportionsScenePoint
): MultipleProportionsAtom {
  return { element, id, position };
}

function molecule(
  id: string,
  position: MultipleProportionsScenePoint,
  atoms: readonly MultipleProportionsAtom[],
  bonds: readonly (readonly [string, string, 1 | 2 | 3])[] = defaultBonds(atoms)
): MultipleProportionsMolecule {
  return { atoms, bonds, id, position };
}

function defaultBonds(atoms: readonly MultipleProportionsAtom[]) {
  return Arr.map(
    Arr.drop(atoms, 1),
    (atomData) => [atoms[0].id, atomData.id, 1] as const
  );
}
