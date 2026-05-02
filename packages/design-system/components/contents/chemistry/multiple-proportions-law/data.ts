import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

export const WATER_PEROXIDE_MODE_ID = "water-peroxide";
export const CARBON_OXIDES_MODE_ID = "carbon-oxides";
export const NITROGEN_OXIDES_MODE_ID = "nitrogen-oxides";

export const MULTIPLE_PROPORTIONS_MODE_IDS = [
  WATER_PEROXIDE_MODE_ID,
  CARBON_OXIDES_MODE_ID,
  NITROGEN_OXIDES_MODE_ID,
] as const;

export type MultipleProportionsModeId =
  (typeof MULTIPLE_PROPORTIONS_MODE_IDS)[number];

export type MultipleProportionsElement =
  | "carbon"
  | "hydrogen"
  | "nitrogen"
  | "oxygen";

export type MultipleProportionsSceneColors = ReturnType<
  typeof getMultipleProportionsSceneColors
>;
export type MultipleProportionsScenePoint = readonly [number, number, number];

export interface MultipleProportionsAtom {
  element: MultipleProportionsElement;
  id: string;
  position: MultipleProportionsScenePoint;
}

export interface MultipleProportionsMolecule {
  atoms: readonly MultipleProportionsAtom[];
  bonds: readonly (readonly [string, string])[];
  id: string;
  position: MultipleProportionsScenePoint;
}

export interface MultipleProportionsCompoundModel {
  label: string;
  molecules: readonly MultipleProportionsMolecule[];
}

export interface MultipleProportionsModeModel {
  first: MultipleProportionsCompoundModel;
  second: MultipleProportionsCompoundModel;
}

export interface MultipleProportionsModeLabels {
  changing: ReactNode;
  fixed: ReactNode;
  helperCaption: ReactNode;
  tab: ReactNode;
  tabLabel: string;
}

export interface MultipleProportionsLabLabels {
  changingLabel: string;
  chooseMode: string;
  comparisonView: string;
  fixedLabel: string;
  modes: Record<MultipleProportionsModeId, MultipleProportionsModeLabels>;
}

export interface MultipleProportionsLabProps {
  description: ReactNode;
  labels: MultipleProportionsLabLabels;
  title: ReactNode;
}

export const MULTIPLE_PROPORTIONS_SCENE_VIEW = {
  cameraPosition: [0, 2.25, 4.9],
  cameraTarget: [0, 0, 0],
  narrowCameraPosition: [0, 2.65, 5.55],
} satisfies Record<string, MultipleProportionsScenePoint>;

export const MULTIPLE_PROPORTIONS_MODELS = {
  [WATER_PEROXIDE_MODE_ID]: {
    first: {
      label: "H\u2082O",
      molecules: [
        molecule(
          "water",
          [0, 0, 0],
          [
            atom("water-o", "oxygen", [0, 0.02, 0]),
            atom("water-h-left", "hydrogen", [-0.28, -0.12, 0.05]),
            atom("water-h-right", "hydrogen", [0.28, -0.12, -0.05]),
          ]
        ),
      ],
    },
    second: {
      label: "H\u2082O\u2082",
      molecules: [
        molecule(
          "peroxide",
          [0, 0, 0],
          [
            atom("peroxide-o-left", "oxygen", [-0.15, 0.02, 0.03]),
            atom("peroxide-o-right", "oxygen", [0.15, 0.02, -0.03]),
            atom("peroxide-h-left", "hydrogen", [-0.43, -0.11, 0.06]),
            atom("peroxide-h-right", "hydrogen", [0.43, -0.11, -0.06]),
          ],
          [
            ["peroxide-o-left", "peroxide-o-right"],
            ["peroxide-o-left", "peroxide-h-left"],
            ["peroxide-o-right", "peroxide-h-right"],
          ]
        ),
      ],
    },
  },
  [CARBON_OXIDES_MODE_ID]: {
    first: {
      label: "CO",
      molecules: [
        molecule(
          "carbon-monoxide",
          [0, 0, 0],
          [
            atom("carbon-monoxide-c", "carbon", [-0.14, 0, 0.02]),
            atom("carbon-monoxide-o", "oxygen", [0.16, 0, -0.02]),
          ]
        ),
      ],
    },
    second: {
      label: "CO\u2082",
      molecules: [
        molecule(
          "carbon-dioxide",
          [0, 0, 0],
          [
            atom("carbon-dioxide-o-left", "oxygen", [-0.32, 0, 0.02]),
            atom("carbon-dioxide-c", "carbon", [0, 0, 0]),
            atom("carbon-dioxide-o-right", "oxygen", [0.32, 0, -0.02]),
          ],
          [
            ["carbon-dioxide-c", "carbon-dioxide-o-left"],
            ["carbon-dioxide-c", "carbon-dioxide-o-right"],
          ]
        ),
      ],
    },
  },
  [NITROGEN_OXIDES_MODE_ID]: {
    first: {
      label: "2N\u2082O",
      molecules: [
        molecule(
          "nitrous-oxide-top",
          [0, 0.2, 0],
          [
            atom("nitrous-oxide-top-n-left", "nitrogen", [-0.25, 0, 0.04]),
            atom("nitrous-oxide-top-n-right", "nitrogen", [0, 0, 0]),
            atom("nitrous-oxide-top-o", "oxygen", [0.27, 0, -0.04]),
          ],
          [
            ["nitrous-oxide-top-n-left", "nitrous-oxide-top-n-right"],
            ["nitrous-oxide-top-n-right", "nitrous-oxide-top-o"],
          ]
        ),
        molecule(
          "nitrous-oxide-bottom",
          [0, -0.22, 0],
          [
            atom("nitrous-oxide-bottom-n-left", "nitrogen", [-0.25, 0, -0.04]),
            atom("nitrous-oxide-bottom-n-right", "nitrogen", [0, 0, 0]),
            atom("nitrous-oxide-bottom-o", "oxygen", [0.27, 0, 0.04]),
          ],
          [
            ["nitrous-oxide-bottom-n-left", "nitrous-oxide-bottom-n-right"],
            ["nitrous-oxide-bottom-n-right", "nitrous-oxide-bottom-o"],
          ]
        ),
      ],
    },
    second: {
      label: "NO\u2082",
      molecules: [
        molecule(
          "nitrogen-dioxide",
          [0, 0, 0],
          [
            atom("nitrogen-dioxide-o-left", "oxygen", [-0.28, -0.08, 0.04]),
            atom("nitrogen-dioxide-n", "nitrogen", [0, 0.1, 0]),
            atom("nitrogen-dioxide-o-right", "oxygen", [0.28, -0.08, -0.04]),
          ],
          [
            ["nitrogen-dioxide-n", "nitrogen-dioxide-o-left"],
            ["nitrogen-dioxide-n", "nitrogen-dioxide-o-right"],
          ]
        ),
      ],
    },
  },
} satisfies Record<MultipleProportionsModeId, MultipleProportionsModeModel>;

export function isMultipleProportionsModeId(
  value: string
): value is MultipleProportionsModeId {
  return value in MULTIPLE_PROPORTIONS_MODELS;
}

export function getMultipleProportionsSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = resolvedTheme === "dark";

  return {
    bond: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    carbon: isDarkTheme ? getColor("ZINC") : getColor("STONE"),
    hydrogen: isDarkTheme ? getColor("ZINC") : getColor("NEUTRAL"),
    nitrogen: getColor("VIOLET"),
    oxygen: getColor("SKY"),
    sphereText: ORIGIN_COLOR.LIGHT,
    sphereTextOutline: isDarkTheme ? ORIGIN_COLOR.DARK : getColor("SLATE"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}

function atom(
  id: string,
  element: MultipleProportionsElement,
  position: MultipleProportionsScenePoint
): MultipleProportionsAtom {
  return { element, id, position };
}

function molecule(
  id: string,
  position: MultipleProportionsScenePoint,
  atoms: readonly MultipleProportionsAtom[],
  bonds: readonly (readonly [string, string])[] = defaultBonds(atoms)
): MultipleProportionsMolecule {
  return { atoms, bonds, id, position };
}

function defaultBonds(atoms: readonly MultipleProportionsAtom[]) {
  return atoms.slice(1).map((atomData) => [atoms[0].id, atomData.id] as const);
}
