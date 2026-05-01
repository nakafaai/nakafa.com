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
] satisfies ChemicalReactionTypeScenePoint[];

const PRODUCT_POINTS = [
  [-0.28, -0.04, 0.02],
  [0, 0.16, 0.02],
  [0.28, -0.04, 0.02],
  [-0.14, -0.28, 0.12],
  [0.14, -0.28, -0.12],
] satisfies ChemicalReactionTypeScenePoint[];

const PRODUCT_PHOSPHORUS_POINTS = [
  [-0.13, -0.08, 0],
  [0.13, -0.08, 0],
  [0, 0.22, 0.12],
  [0, 0.02, -0.24],
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
        radius={0.12}
      />
      <ParticleCluster
        color={colors.phosphorus}
        label="P"
        labelColor={colors.sphereText}
        labelOutlineColor={colors.sphereTextOutline}
        points={PRODUCT_PHOSPHORUS_POINTS}
        radius={0.1}
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
