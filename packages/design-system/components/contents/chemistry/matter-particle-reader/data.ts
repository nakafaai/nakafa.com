import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Schema } from "effect";
import type { ReactNode } from "react";

export const ATOM_MODE_ID = "atom";
export const ELEMENT_MODE_ID = "element";
export const ELEMENTAL_MOLECULE_MODE_ID = "elemental-molecule";
export const COMPOUND_MOLECULE_MODE_ID = "compound-molecule";

export const MATTER_PARTICLE_MODE_IDS = [
  ATOM_MODE_ID,
  ELEMENT_MODE_ID,
  ELEMENTAL_MOLECULE_MODE_ID,
  COMPOUND_MOLECULE_MODE_ID,
] as const;

const MatterParticleElementSchema = Schema.Literals([
  "carbon",
  "hydrogen",
  "nitrogen",
  "oxygen",
]);
export type MatterParticleElement = typeof MatterParticleElementSchema.Type;
export type MatterParticleModeId = (typeof MATTER_PARTICLE_MODE_IDS)[number];
export type MatterParticleSceneColors = ReturnType<
  typeof getMatterParticleSceneColors
>;

const MatterParticleScenePointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type MatterParticleScenePoint =
  typeof MatterParticleScenePointSchema.Type;

const MatterParticleAtomSchema = Schema.Struct({
  element: MatterParticleElementSchema,
  id: Schema.String,
  position: MatterParticleScenePointSchema,
});
export type MatterParticleAtom = typeof MatterParticleAtomSchema.Type;

const MatterParticleMoleculeSchema = Schema.Struct({
  atoms: Schema.Array(MatterParticleAtomSchema),
  bonds: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  formula: Schema.String,
  id: Schema.String,
  position: MatterParticleScenePointSchema,
  scale: Schema.optionalKey(Schema.Finite),
});
export type MatterParticleMolecule = typeof MatterParticleMoleculeSchema.Type;

const MatterParticleModelSchema = Schema.Struct({
  molecules: Schema.Array(MatterParticleMoleculeSchema),
});
export type MatterParticleModel = typeof MatterParticleModelSchema.Type;

export interface MatterParticleModeLabels {
  category: ReactNode;
  helperCaption: ReactNode;
  reading: ReactNode;
  tab: ReactNode;
  tabLabel: string;
}

export interface MatterParticleReaderLabels {
  categoryLabel: string;
  chooseMode: string;
  modes: Record<MatterParticleModeId, MatterParticleModeLabels>;
  particleView: string;
  readingLabel: string;
}

export const MATTER_PARTICLE_SCENE_VIEW = {
  cameraPosition: [0, 2.05, 4.6],
  cameraTarget: [0, 0, 0],
  narrowCameraPosition: [0, 2.45, 5.35],
} satisfies Record<string, MatterParticleScenePoint>;

export const MATTER_PARTICLE_MODELS = {
  [ATOM_MODE_ID]: {
    molecules: [
      molecule(
        "carbon-atom",
        "C",
        [0, -0.04, 0],
        [atom("carbon-atom-c", "carbon", [0, 0, 0])],
        []
      ),
    ],
  },
  [ELEMENT_MODE_ID]: {
    molecules: [
      molecule(
        "carbon-element",
        "C",
        [0, -0.04, 0],
        [...atomCluster("carbon-element", "carbon", 6, 0.34)],
        []
      ),
    ],
  },
  [ELEMENTAL_MOLECULE_MODE_ID]: {
    molecules: [
      molecule(
        "oxygen-molecule",
        "\\mathrm{O_2}",
        [-0.62, -0.04, 0],
        [
          atom("oxygen-molecule-left", "oxygen", [-0.16, 0, 0.02]),
          atom("oxygen-molecule-right", "oxygen", [0.16, 0, -0.02]),
        ]
      ),
      molecule(
        "nitrogen-molecule",
        "\\mathrm{N_2}",
        [0.62, -0.04, 0],
        [
          atom("nitrogen-molecule-left", "nitrogen", [-0.16, 0, 0.02]),
          atom("nitrogen-molecule-right", "nitrogen", [0.16, 0, -0.02]),
        ]
      ),
    ],
  },
  [COMPOUND_MOLECULE_MODE_ID]: {
    molecules: [
      molecule(
        "water-molecule",
        "\\mathrm{H_2O}",
        [-0.62, -0.04, 0],
        [
          atom("water-o", "oxygen", [0, 0.04, 0]),
          atom("water-h-left", "hydrogen", [-0.27, -0.12, 0.06]),
          atom("water-h-right", "hydrogen", [0.27, -0.12, -0.06]),
        ],
        undefined,
        1.08
      ),
      molecule(
        "carbon-dioxide-molecule",
        "\\mathrm{CO_2}",
        [0.62, -0.04, 0],
        [
          atom("carbon-dioxide-o-left", "oxygen", [-0.32, 0, 0.03]),
          atom("carbon-dioxide-c", "carbon", [0, 0, 0]),
          atom("carbon-dioxide-o-right", "oxygen", [0.32, 0, -0.03]),
        ],
        [
          ["carbon-dioxide-c", "carbon-dioxide-o-left"],
          ["carbon-dioxide-c", "carbon-dioxide-o-right"],
        ],
        1.02
      ),
    ],
  },
} satisfies Record<MatterParticleModeId, MatterParticleModel>;

export function isMatterParticleModeId(
  value: string
): value is MatterParticleModeId {
  return value in MATTER_PARTICLE_MODELS;
}

export function getMatterParticleSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

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
  element: MatterParticleElement,
  position: MatterParticleScenePoint
): MatterParticleAtom {
  return { element, id, position };
}

function atomCluster(
  idPrefix: string,
  element: MatterParticleElement,
  count: number,
  radius: number
) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.68;
    const z = Math.sin(angle * 1.5) * 0.08;

    return atom(`${idPrefix}-${index}`, element, [x, y, z]);
  });
}

function molecule(
  id: string,
  formula: string,
  position: MatterParticleScenePoint,
  atoms: readonly MatterParticleAtom[],
  bonds: readonly (readonly [string, string])[] = defaultBonds(atoms),
  scale?: number
): MatterParticleMolecule {
  return {
    atoms,
    bonds,
    formula,
    id,
    position,
    ...(scale === undefined ? {} : { scale }),
  };
}

function defaultBonds(atoms: readonly MatterParticleAtom[]) {
  return atoms.slice(1).map((atomData) => [atoms[0].id, atomData.id] as const);
}
