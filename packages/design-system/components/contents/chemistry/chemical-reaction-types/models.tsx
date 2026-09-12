import { RoundedBox } from "@react-three/drei";
import {
  type ChemicalReactionTypeId,
  type ChemicalReactionTypeSceneColors,
  type ChemicalReactionTypeScenePoint,
  COMBUSTION_TYPE_ID,
  GAS_TYPE_ID,
  PRECIPITATE_TYPE_ID,
  RUST_TYPE_ID,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  FloatingIons,
  GasBubbles,
  HeatRays,
  RustPatches,
  SettledSolid,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/effects";
import {
  Beaker,
  DiatomicMolecule,
  Particle,
  ParticleCluster,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/parts";

const PHOSPHORUS_POINTS = [
  [-0.18, -0.08, 0],
  [0.18, -0.08, 0],
  [0, 0.22, 0.12],
  [0, 0.02, -0.24],
] satisfies ChemicalReactionTypeScenePoint[];

const OXYGEN_PAIR_POINTS = [
  [-0.34, 0.42, 0.05],
  [0.34, 0.42, 0.05],
  [-0.42, -0.13, 0.18],
  [0.42, -0.13, 0.18],
  [0, -0.47, 0.12],
] satisfies ChemicalReactionTypeScenePoint[];

// PubChem 3D conformer, both product point sets uniformly scaled by 0.17.
// https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/14812/SDF?record_type=3d
const PRODUCT_POINTS = [
  [0.122_196, -0.275_366, -0.041_463],
  [-0.177_242, -0.111_843, 0.220_371],
  [-0.214_829, -0.064_379, -0.205_445],
  [0.214_829, 0.064_413, 0.205_462],
  [0.177_259, 0.111_809, -0.220_388],
  [-0.122_196, 0.275_366, 0.041_463],
  [-0.283_764, -0.474_912, -0.027_897],
  [0.540_787, -0.104_278, -0.059_313],
  [-0.089_063, 0.239_717, 0.491_334],
  [-0.167_994, 0.339_507, -0.404_175],
] satisfies ChemicalReactionTypeScenePoint[];

const PRODUCT_PHOSPHORUS_POINTS = [
  [-0.153_391, -0.2567, -0.015_079],
  [0.292_315, -0.056_355, -0.032_045],
  [-0.048_11, 0.129_54, 0.265_591],
  [-0.090_797, 0.183_481, -0.218_467],
] satisfies ChemicalReactionTypeScenePoint[];

type ReactionPhase = "after" | "before";

export function ReactionModel({
  colors,
  phase,
  typeId,
}: {
  colors: ChemicalReactionTypeSceneColors;
  phase: ReactionPhase;
  typeId: ChemicalReactionTypeId;
}) {
  if (typeId === COMBUSTION_TYPE_ID) {
    return <CombustionModel colors={colors} phase={phase} />;
  }

  if (typeId === RUST_TYPE_ID) {
    return <RustModel colors={colors} phase={phase} />;
  }

  if (typeId === PRECIPITATE_TYPE_ID) {
    return <PrecipitateModel colors={colors} phase={phase} />;
  }

  if (typeId === GAS_TYPE_ID) {
    return <GasModel colors={colors} phase={phase} />;
  }

  return null;
}

function CombustionModel({
  colors,
  phase,
}: {
  colors: ChemicalReactionTypeSceneColors;
  phase: ReactionPhase;
}) {
  if (phase === "before") {
    return (
      <group>
        <ParticleCluster
          color={colors.phosphorus}
          label="P"
          labelColor={colors.sphereText}
          labelOutlineColor={colors.sphereTextOutline}
          points={PHOSPHORUS_POINTS}
          radius={0.13}
        />
        {OXYGEN_PAIR_POINTS.map((position) => (
          <DiatomicMolecule
            color={colors.oxygen}
            key={position.join(",")}
            label="O"
            labelColor={colors.sphereText}
            labelOutlineColor={colors.sphereTextOutline}
            position={position}
          />
        ))}
      </group>
    );
  }

  return (
    <group>
      <ParticleCluster
        color={colors.oxygen}
        label="O"
        labelColor={colors.sphereText}
        labelOutlineColor={colors.sphereTextOutline}
        points={PRODUCT_POINTS}
        radius={0.1}
      />
      <ParticleCluster
        color={colors.phosphorus}
        label="P"
        labelColor={colors.sphereText}
        labelOutlineColor={colors.sphereTextOutline}
        points={PRODUCT_PHOSPHORUS_POINTS}
        radius={0.13}
      />
      <HeatRays color={colors.flame} />
    </group>
  );
}

function RustModel({
  colors,
  phase,
}: {
  colors: ChemicalReactionTypeSceneColors;
  phase: ReactionPhase;
}) {
  return (
    <group rotation={[-0.12, 0.2, 0]}>
      <RoundedBox args={[1.05, 0.18, 0.62]} radius={0.04} smoothness={3}>
        <meshStandardMaterial
          color={phase === "before" ? colors.iron : colors.rust}
          metalness={phase === "before" ? 0.36 : 0.05}
          roughness={0.55}
        />
      </RoundedBox>
      {phase === "after" && <RustPatches color={colors.rustPatch} />}
      {phase === "before" && (
        <group position={[0, 0.35, 0]}>
          <DiatomicMolecule
            color={colors.oxygen}
            label="O"
            labelColor={colors.sphereText}
            labelOutlineColor={colors.sphereTextOutline}
            position={[-0.22, 0, 0.04]}
          />
          <Particle
            color={colors.hydrogen}
            label="H"
            labelColor={colors.sphereText}
            labelOutlineColor={colors.sphereTextOutline}
            position={[0.34, 0.03, 0]}
            radius={0.11}
          />
        </group>
      )}
    </group>
  );
}

function PrecipitateModel({
  colors,
  phase,
}: {
  colors: ChemicalReactionTypeSceneColors;
  phase: ReactionPhase;
}) {
  return (
    <Beaker colors={colors}>
      {phase === "before" ? (
        <FloatingIons colors={colors} />
      ) : (
        <SettledSolid colors={colors} />
      )}
    </Beaker>
  );
}

function GasModel({
  colors,
  phase,
}: {
  colors: ChemicalReactionTypeSceneColors;
  phase: ReactionPhase;
}) {
  return (
    <Beaker colors={colors}>
      {phase === "before" ? (
        <ParticleCluster
          color={colors.carbon}
          label="C"
          labelColor={colors.sphereText}
          labelOutlineColor={colors.sphereTextOutline}
          points={[
            [-0.16, -0.2, 0.06],
            [0.02, -0.04, -0.08],
            [0.2, -0.18, 0.08],
          ]}
          radius={0.08}
        />
      ) : (
        <GasBubbles color={colors.bubble} />
      )}
    </Beaker>
  );
}
