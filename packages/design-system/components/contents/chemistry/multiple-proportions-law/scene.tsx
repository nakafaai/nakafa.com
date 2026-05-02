import { Line } from "@react-three/drei";
import {
  MULTIPLE_PROPORTIONS_MODELS,
  type MultipleProportionsAtom,
  type MultipleProportionsCompoundModel,
  type MultipleProportionsElement,
  type MultipleProportionsModeId,
  type MultipleProportionsMolecule,
  type MultipleProportionsSceneColors,
} from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/data";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelFontSize,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const FIRST_X = -0.78;
const SECOND_X = 0.78;
const SCENE_SCALE = 1.95;
const BOND_LINE_WIDTH = 2.4;
const FORMULA_LABEL_Y = 0.58;

export function MultipleProportionsScene({
  colors,
  modeId,
}: {
  colors: MultipleProportionsSceneColors;
  modeId: MultipleProportionsModeId;
}) {
  const model = MULTIPLE_PROPORTIONS_MODELS[modeId];

  return (
    <group position={[0, -0.02, 0]} scale={SCENE_SCALE}>
      <CompoundStage colors={colors} model={model.first} x={FIRST_X} />
      <CompoundStage colors={colors} model={model.second} x={SECOND_X} />
    </group>
  );
}

function CompoundStage({
  colors,
  model,
  x,
}: {
  colors: MultipleProportionsSceneColors;
  model: MultipleProportionsCompoundModel;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <SceneLabel
        color={colors.text}
        fontSize="marker"
        position={[0, FORMULA_LABEL_Y, 0.34]}
      >
        {model.label}
      </SceneLabel>

      <group position={[0, 0.02, 0]}>
        {model.molecules.map((molecule) => (
          <Molecule colors={colors} key={molecule.id} molecule={molecule} />
        ))}
      </group>
    </group>
  );
}

function Molecule({
  colors,
  molecule,
}: {
  colors: MultipleProportionsSceneColors;
  molecule: MultipleProportionsMolecule;
}) {
  const atomsById = new Map(
    molecule.atoms.map((atomData) => [atomData.id, atomData])
  );

  return (
    <group position={molecule.position}>
      {molecule.bonds.map(([startId, endId]) => {
        const start = atomsById.get(startId);
        const end = atomsById.get(endId);

        if (!(start && end)) {
          return null;
        }

        return (
          <Line
            color={colors.bond}
            key={`${startId}-${endId}`}
            lineWidth={BOND_LINE_WIDTH}
            points={[start.position, end.position]}
          />
        );
      })}

      {molecule.atoms.map((atomData) => (
        <AtomParticle atomData={atomData} colors={colors} key={atomData.id} />
      ))}
    </group>
  );
}

function AtomParticle({
  atomData,
  colors,
}: {
  atomData: MultipleProportionsAtom;
  colors: MultipleProportionsSceneColors;
}) {
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
        fontSize={getChemistryParticleLabelFontSize(radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(radius)}
      >
        {atomSymbol(atomData.element)}
      </ChemistryParticleLabel>
    </group>
  );
}

function atomRadius(element: MultipleProportionsElement) {
  if (element === "hydrogen") {
    return 0.1;
  }

  if (element === "carbon") {
    return 0.14;
  }

  return 0.15;
}

function atomSymbol(element: MultipleProportionsElement) {
  if (element === "carbon") {
    return "C";
  }

  if (element === "hydrogen") {
    return "H";
  }

  if (element === "nitrogen") {
    return "N";
  }

  return "O";
}

function atomColor(
  element: MultipleProportionsElement,
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
