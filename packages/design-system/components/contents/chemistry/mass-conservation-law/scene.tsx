import { useFrame } from "@react-three/fiber";
import {
  type MassConservationLabLabels,
  type MassConservationModeId,
  type MassConservationSceneColors,
  type MassConservationScenePoint,
  OPEN_SYSTEM_MODE_ID,
} from "@repo/design-system/components/contents/chemistry/mass-conservation-law/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import { useRef } from "react";
import { DoubleSide, type Mesh, type MeshStandardMaterial } from "three";

const BEFORE_X = -1.08;
const AFTER_X = 1.08;
const STAGE_LABEL_Y = 1.2;
const READOUT_Y = -0.98;
const SCENE_SCALE = 1.32;
const VESSEL_HEIGHT = 1.22;
const VESSEL_RADIUS = 0.48;
const PARTICLE_RADIUS = 0.075;
const GAS_RISE_HEIGHT = 0.7;
const GAS_START_OPACITY = 0.56;

const BEFORE_PARTICLES = [
  { id: "zn-1", element: "zinc", position: [-0.22, -0.38, 0.05] },
  { id: "zn-2", element: "zinc", position: [-0.04, -0.3, -0.12] },
  { id: "zn-3", element: "zinc", position: [0.17, -0.39, 0.1] },
  { id: "zn-4", element: "zinc", position: [0.06, -0.16, 0.02] },
  { id: "s-1", element: "sulfur", position: [-0.16, -0.08, -0.03] },
  { id: "s-2", element: "sulfur", position: [0.2, -0.11, -0.08] },
] satisfies ConservationParticle[];

const AFTER_PRODUCTS = [
  {
    id: "zns-1",
    position: [-0.16, -0.36, 0.04],
    sulfurOffset: [0.13, 0.03, 0.02],
  },
  {
    id: "zns-2",
    position: [0.09, -0.33, -0.08],
    sulfurOffset: [0.13, -0.02, 0.02],
  },
] satisfies ProductPairData[];

const LEFTOVER_ZINC = [
  { id: "leftover-zn-1", element: "zinc", position: [-0.04, -0.1, 0.1] },
  { id: "leftover-zn-2", element: "zinc", position: [0.22, -0.14, 0.06] },
] satisfies ConservationParticle[];

const ESCAPED_GAS_PARTICLES = [
  {
    drift: 0.05,
    id: "gas-left",
    phase: 0.04,
    position: [-0.1, 0.66, 0.08],
    speed: 0.34,
  },
  {
    drift: 0.04,
    id: "gas-center",
    phase: 0.34,
    position: [0.04, 0.72, -0.02],
    speed: 0.3,
  },
  {
    drift: 0.045,
    id: "gas-left-high",
    phase: 0.52,
    position: [-0.03, 0.74, 0.06],
    speed: 0.31,
  },
  {
    drift: 0.06,
    id: "gas-right",
    phase: 0.68,
    position: [0.16, 0.63, 0.1],
    speed: 0.32,
  },
  {
    drift: 0.05,
    id: "gas-right-low",
    phase: 0.82,
    position: [0.09, 0.66, -0.08],
    speed: 0.35,
  },
] satisfies EscapedGasParticle[];

type ParticleElement = "sulfur" | "zinc";
type ReactionPhase = "after" | "before";

interface ConservationParticle {
  element: ParticleElement;
  id: string;
  position: MassConservationScenePoint;
}

interface ProductPairData {
  id: string;
  position: MassConservationScenePoint;
  sulfurOffset: MassConservationScenePoint;
}

interface EscapedGasParticle {
  drift: number;
  id: string;
  phase: number;
  position: MassConservationScenePoint;
  speed: number;
}

export function MassConservationScene({
  colors,
  labels,
  modeId,
}: {
  colors: MassConservationSceneColors;
  labels: Pick<MassConservationLabLabels, "after" | "before" | "modes">;
  modeId: MassConservationModeId;
}) {
  const modeLabels = labels.modes[modeId];
  const isOpen = modeId === OPEN_SYSTEM_MODE_ID;

  return (
    <group position={[0, -0.03, 0]} scale={SCENE_SCALE}>
      <BalanceStage
        colors={colors}
        isOpen={isOpen}
        phase="before"
        readout={modeLabels.readoutBefore}
        title={labels.before}
        x={BEFORE_X}
      />

      <ArrowHelper
        arrowSize={0.13}
        color={colors.arrow}
        from={[-0.38, 0.04, 0.05]}
        lineWidth={3}
        to={[0.38, 0.04, 0.05]}
      />

      <BalanceStage
        colors={colors}
        isOpen={isOpen}
        phase="after"
        readout={modeLabels.readoutAfter}
        title={labels.after}
        x={AFTER_X}
      />
    </group>
  );
}

function BalanceStage({
  colors,
  isOpen,
  phase,
  readout,
  title,
  x,
}: {
  colors: MassConservationSceneColors;
  isOpen: boolean;
  phase: ReactionPhase;
  readout: string;
  title: string;
  x: number;
}) {
  const hasEscapedGas = isOpen && phase === "after";

  return (
    <group position={[x, 0, 0]}>
      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize="compact"
        position={[0, STAGE_LABEL_Y, 0.28]}
      >
        {title}
      </SceneLabel>

      <Vessel closed={!isOpen} colors={colors} />
      <Particles colors={colors} phase={phase} />
      {hasEscapedGas && <EscapedGas colors={colors} />}
      <BalanceBase color={colors.balance} />

      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize="compact"
        position={[0, READOUT_Y, 0.5]}
      >
        {readout}
      </SceneLabel>
    </group>
  );
}

function Vessel({
  closed,
  colors,
}: {
  closed: boolean;
  colors: MassConservationSceneColors;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[
            VESSEL_RADIUS,
            VESSEL_RADIUS * 0.92,
            VESSEL_HEIGHT,
            64,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color={colors.glass}
          depthWrite={false}
          opacity={0.22}
          roughness={0.08}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <mesh position={[0, VESSEL_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[VESSEL_RADIUS, 0.018, 16, 72]} />
        <meshStandardMaterial color={colors.glass} opacity={0.56} transparent />
      </mesh>

      {closed && (
        <mesh position={[0, VESSEL_HEIGHT / 2 + 0.03, 0]}>
          <cylinderGeometry
            args={[VESSEL_RADIUS * 0.88, VESSEL_RADIUS * 0.88, 0.04, 64]}
          />
          <meshStandardMaterial color={colors.cap} opacity={0.42} transparent />
        </mesh>
      )}

      <mesh position={[0, -VESSEL_HEIGHT / 2, 0]}>
        <cylinderGeometry
          args={[VESSEL_RADIUS * 0.92, VESSEL_RADIUS * 0.92, 0.04, 64]}
        />
        <meshStandardMaterial color={colors.glass} opacity={0.36} transparent />
      </mesh>
    </group>
  );
}

function Particles({
  colors,
  phase,
}: {
  colors: MassConservationSceneColors;
  phase: ReactionPhase;
}) {
  if (phase === "before") {
    return (
      <group>
        {BEFORE_PARTICLES.map((particle) => (
          <Particle colors={colors} key={particle.id} particle={particle} />
        ))}
      </group>
    );
  }

  return (
    <group>
      {AFTER_PRODUCTS.map((pair) => (
        <ProductPair colors={colors} key={pair.id} pair={pair} />
      ))}
      {LEFTOVER_ZINC.map((particle) => (
        <Particle colors={colors} key={particle.id} particle={particle} />
      ))}
    </group>
  );
}

function ProductPair({
  colors,
  pair,
}: {
  colors: MassConservationSceneColors;
  pair: ProductPairData;
}) {
  const [x, y, z] = pair.position;
  const [sulfurX, sulfurY, sulfurZ] = pair.sulfurOffset;

  return (
    <group>
      <Particle
        colors={colors}
        particle={{
          element: "zinc",
          id: `${pair.id}-zn`,
          position: pair.position,
        }}
      />
      <Particle
        colors={colors}
        particle={{
          element: "sulfur",
          id: `${pair.id}-s`,
          position: [x + sulfurX, y + sulfurY, z + sulfurZ],
        }}
      />
      <mesh position={[x + sulfurX / 2, y + sulfurY / 2, z + sulfurZ / 2]}>
        <sphereGeometry args={[PARTICLE_RADIUS * 0.38, 16, 12]} />
        <meshStandardMaterial color={colors.product} roughness={0.32} />
      </mesh>
    </group>
  );
}

function Particle({
  colors,
  particle,
}: {
  colors: MassConservationSceneColors;
  particle: ConservationParticle;
}) {
  const color = particle.element === "zinc" ? colors.zinc : colors.sulfur;

  return (
    <mesh castShadow position={particle.position}>
      <sphereGeometry args={[PARTICLE_RADIUS, 24, 16]} />
      <meshStandardMaterial color={color} roughness={0.34} />
    </mesh>
  );
}

function EscapedGas({ colors }: { colors: MassConservationSceneColors }) {
  return (
    <group>
      {ESCAPED_GAS_PARTICLES.map((particle) => (
        <AnimatedEscapedGas
          color={colors.escapedGas}
          key={particle.id}
          particle={particle}
        />
      ))}
    </group>
  );
}

function AnimatedEscapedGas({
  color,
  particle,
}: {
  color: string;
  particle: EscapedGasParticle;
}) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const meshRef = useRef<Mesh>(null);
  const [x, y] = particle.position;

  useFrame(({ clock }) => {
    if (!(meshRef.current && materialRef.current)) {
      return;
    }

    const progress = (clock.elapsedTime * particle.speed + particle.phase) % 1;
    const drift = Math.sin(progress * Math.PI * 2) * particle.drift;

    meshRef.current.position.x = x + drift;
    meshRef.current.position.y = y + progress * GAS_RISE_HEIGHT;
    meshRef.current.scale.setScalar(0.74 + progress * 0.48);
    materialRef.current.opacity = GAS_START_OPACITY * (1 - progress);
  });

  return (
    <mesh position={particle.position} ref={meshRef}>
      <sphereGeometry args={[PARTICLE_RADIUS * 0.72, 18, 12]} />
      <meshStandardMaterial
        color={color}
        opacity={GAS_START_OPACITY}
        ref={materialRef}
        transparent
      />
    </mesh>
  );
}

function BalanceBase({ color }: { color: string }) {
  return (
    <group position={[0, -0.72, 0]}>
      <mesh castShadow receiveShadow scale={[0.72, 0.06, 0.48]}>
        <boxGeometry />
        <meshStandardMaterial color={color} roughness={0.52} />
      </mesh>
      <mesh position={[0, -0.1, 0]} scale={[0.42, 0.08, 0.28]}>
        <boxGeometry />
        <meshStandardMaterial color={color} roughness={0.48} />
      </mesh>
    </group>
  );
}
