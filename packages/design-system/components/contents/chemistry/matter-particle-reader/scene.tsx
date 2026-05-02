import { Line } from "@react-three/drei";
import {
  MATTER_PARTICLE_MODELS,
  type MatterParticleAtom,
  type MatterParticleElement,
  type MatterParticleModeId,
  type MatterParticleMolecule,
  type MatterParticleSceneColors,
} from "@repo/design-system/components/contents/chemistry/matter-particle-reader/data";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelFontSize,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const SCENE_SCALE = 1.9;
const FORMULA_LABEL_Y = 0.62;
const BOND_LINE_WIDTH = 2.6;

export function MatterParticleReaderScene({
  colors,
  modeId,
}: {
  colors: MatterParticleSceneColors;
  modeId: MatterParticleModeId;
}) {
  const model = MATTER_PARTICLE_MODELS[modeId];

  return (
    <group position={[0, -0.04, 0]} scale={SCENE_SCALE}>
      {model.molecules.map((molecule) => (
        <MoleculeStage colors={colors} key={molecule.id} molecule={molecule} />
      ))}
    </group>
  );
}

function MoleculeStage({
  colors,
  molecule,
}: {
  colors: MatterParticleSceneColors;
  molecule: MatterParticleMolecule;
}) {
  const atomsById = new Map(
    molecule.atoms.map((atomData) => [atomData.id, atomData])
  );

  return (
    <group position={molecule.position} scale={molecule.scale ?? 1}>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0, FORMULA_LABEL_Y, 0.32]}
      >
        {molecule.label}
      </SceneLabel>

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
  atomData: MatterParticleAtom;
  colors: MatterParticleSceneColors;
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

function atomRadius(element: MatterParticleElement) {
  if (element === "hydrogen") {
    return 0.1;
  }

  return 0.15;
}

function atomSymbol(element: MatterParticleElement) {
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
  element: MatterParticleElement,
  colors: MatterParticleSceneColors
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
