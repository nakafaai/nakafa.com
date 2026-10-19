import { Line } from "@react-three/drei";
import type { ElementName } from "@repo/design-system/components/contents/chemistry/element";
import {
  MULTIPLE_PROPORTIONS_MODELS,
  type MultipleProportionsAtom,
  type MultipleProportionsCompoundModel,
  type MultipleProportionsModeId,
  type MultipleProportionsMolecule,
  type MultipleProportionsSceneColors,
} from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/data";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import { atomSymbol } from "@repo/design-system/components/contents/chemistry/symbol";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Array as Arr, HashMap, Option } from "effect";
import { createContext, type ReactNode, use } from "react";

const FIRST_X = -0.78;
const SECOND_X = 0.78;
const SCENE_SCALE = 1.95;
const BOND_LINE_WIDTH = 2.4;

const MultipleProportionsSceneColorsContext =
  createContext<MultipleProportionsSceneColors | null>(null);

/** Provides the colors of one multiple-proportions lab to the parts of its scene. */
export function MultipleProportionsSceneColorsProvider({
  children,
  colors,
}: {
  children: ReactNode;
  colors: MultipleProportionsSceneColors;
}) {
  return (
    <MultipleProportionsSceneColorsContext value={colors}>
      {children}
    </MultipleProportionsSceneColorsContext>
  );
}

/** Reads the colors of the surrounding multiple-proportions lab. */
function useMultipleProportionsSceneColors() {
  const colors = use(MultipleProportionsSceneColorsContext);
  if (!colors) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useMultipleProportionsSceneColors must be used within MultipleProportionsSceneColorsProvider"
    );
  }
  return colors;
}

export function MultipleProportionsScene({
  modeId,
}: {
  modeId: MultipleProportionsModeId;
}) {
  const model = MULTIPLE_PROPORTIONS_MODELS[modeId];

  return (
    <group position={[0, -0.02, 0]} scale={SCENE_SCALE}>
      <CompoundStage model={model.first} x={FIRST_X} />
      <CompoundStage model={model.second} x={SECOND_X} />
    </group>
  );
}

function CompoundStage({
  model,
  x,
}: {
  model: MultipleProportionsCompoundModel;
  x: number;
}) {
  const colors = useMultipleProportionsSceneColors();
  return (
    <group position={[x, 0, 0]}>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[0, 0.56, 0.32]}
      >
        <InlineMath math={model.formula} />
      </ThreeLabel>
      <group position={[0, 0.02, 0]}>
        {Arr.map(model.molecules, (molecule) => (
          <Molecule key={molecule.id} molecule={molecule} />
        ))}
      </group>
    </group>
  );
}

function Molecule({ molecule }: { molecule: MultipleProportionsMolecule }) {
  const colors = useMultipleProportionsSceneColors();
  const atomsById = HashMap.fromIterable(
    Arr.map(molecule.atoms, (atomData) => [atomData.id, atomData])
  );

  return (
    <group position={molecule.position}>
      {Arr.map(molecule.bonds, ([startId, endId]) => {
        const start = HashMap.get(atomsById, startId);
        const end = HashMap.get(atomsById, endId);

        if (Option.isNone(start) || Option.isNone(end)) {
          return null;
        }

        return (
          <Line
            color={colors.bond}
            key={`${startId}-${endId}`}
            lineWidth={BOND_LINE_WIDTH}
            points={[start.value.position, end.value.position]}
          />
        );
      })}

      {Arr.map(molecule.atoms, (atomData) => (
        <AtomParticle atomData={atomData} key={atomData.id} />
      ))}
    </group>
  );
}

function AtomParticle({ atomData }: { atomData: MultipleProportionsAtom }) {
  const colors = useMultipleProportionsSceneColors();
  const radius = atomRadius(atomData.element);

  return (
    <group position={atomData.position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial
          color={atomColor(atomData.element, colors)}
          roughness={0.34}
        />
      </mesh>
      <ChemistryParticleLabel
        color={colors.sphereText}
        fontSize={getThreeParticleLabelFontSize(radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(radius)}
      >
        <InlineMath math={atomSymbol(atomData.element)} />
      </ChemistryParticleLabel>
    </group>
  );
}

function atomRadius(element: ElementName) {
  if (element === "hydrogen") {
    return 0.1;
  }

  if (element === "carbon") {
    return 0.14;
  }

  return 0.15;
}

function atomColor(
  element: ElementName,
  colors: MultipleProportionsSceneColors
) {
  if (element === "carbon") {
    return colors.carbon;
  }

  if (element === "hydrogen") {
    return colors.hydrogen;
  }

  if (element === "nitrogen") {
    return colors.nitrogen;
  }

  return colors.oxygen;
}
