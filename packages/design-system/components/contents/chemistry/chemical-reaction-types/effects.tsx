import { useFrame } from "@react-three/fiber";
import { useChemicalReactionTypeScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import type { ChemicalReactionTypeScenePoint } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { ChemicalReactionTypeScenePointSchema } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  BEAKER_CONTENT_BOTTOM_Y,
  Particle,
  ParticleElementContext,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/parts";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Array as Arr, Schema } from "effect";
import { useRef } from "react";
import type { Group, Mesh } from "three";
import { Vector2 } from "three";

const FLAME_TEARDROP_PROFILE = Arr.map(
  [
    [0.001, 0],
    [0.036, 0.022],
    [0.052, 0.068],
    [0.042, 0.135],
    [0.02, 0.21],
    [0.001, 0.27],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

const FLOATING_ION_POINTS = [
  [-0.18, -0.2, 0.08],
  [0.16, -0.18, -0.06],
  [0, 0.02, 0.1],
] satisfies ChemicalReactionTypeScenePoint[];

const GasBubbleSchema = Schema.Struct({
  phase: Schema.Finite,
  position: ChemicalReactionTypeScenePointSchema,
  speed: Schema.Finite,
});
type GasBubble = typeof GasBubbleSchema.Type;

const BUBBLES = [
  { phase: 0.08, position: [-0.16, -0.28, 0.08], speed: 0.34 },
  { phase: 0.27, position: [0.02, -0.36, -0.08], speed: 0.4 },
  { phase: 0.49, position: [0.18, -0.2, 0.04], speed: 0.37 },
  { phase: 0.71, position: [-0.03, -0.1, 0.1], speed: 0.44 },
] satisfies GasBubble[];

const BUBBLE_RADIUS = 0.052;
const BUBBLE_TRAVEL = 0.54;
const BUBBLE_INITIAL_SCALE = 0.8;
const BUBBLE_GROWTH = 0.34;
const BUBBLE_MAX_RADIUS =
  BUBBLE_RADIUS * (BUBBLE_INITIAL_SCALE + BUBBLE_GROWTH);
const BUBBLE_BOUNDS = {
  x: {
    min:
      Math.min(...Arr.map(BUBBLES, ({ position }) => position[0])) -
      BUBBLE_MAX_RADIUS -
      0.02,
    max:
      Math.max(...Arr.map(BUBBLES, ({ position }) => position[0])) +
      BUBBLE_MAX_RADIUS +
      0.02,
  },
  y: {
    min:
      Math.min(...Arr.map(BUBBLES, ({ position }) => position[1])) -
      BUBBLE_MAX_RADIUS,
    max:
      Math.max(...Arr.map(BUBBLES, ({ position }) => position[1])) +
      BUBBLE_TRAVEL +
      BUBBLE_MAX_RADIUS,
  },
  z: {
    min:
      Math.min(...Arr.map(BUBBLES, ({ position }) => position[2])) -
      BUBBLE_MAX_RADIUS,
    max:
      Math.max(...Arr.map(BUBBLES, ({ position }) => position[2])) +
      BUBBLE_MAX_RADIUS,
  },
};
const SETTLED_SOLID_RADIUS = 0.048;
const SETTLED_SOLID_BASE_Y =
  BEAKER_CONTENT_BOTTOM_Y + SETTLED_SOLID_RADIUS + 0.01;

const SETTLED_SOLID_POINTS = [
  [-0.18, SETTLED_SOLID_BASE_Y, 0.04],
  [-0.08, SETTLED_SOLID_BASE_Y - 0.006, -0.06],
  [0.05, SETTLED_SOLID_BASE_Y, 0.06],
  [0.17, SETTLED_SOLID_BASE_Y + 0.004, -0.03],
  [-0.01, SETTLED_SOLID_BASE_Y + 0.068, 0.01],
  [-0.11, SETTLED_SOLID_BASE_Y + 0.046, 0.08],
  [0.09, SETTLED_SOLID_BASE_Y + 0.048, -0.05],
  [0.02, SETTLED_SOLID_BASE_Y, -0.1],
] satisfies ChemicalReactionTypeScenePoint[];

const HEAT_RAY_OFFSETS = [-0.26, 0, 0.26] as const;

const RUST_PATCHES = [
  { position: [-0.34, 0.095, 0.08], scale: [1.5, 0.32, 1.1] },
  { position: [-0.14, 0.096, -0.12], scale: [1.8, 0.34, 1.3] },
  { position: [0.06, 0.095, 0.14], scale: [1.4, 0.3, 1.15] },
  { position: [0.24, 0.096, -0.04], scale: [1.65, 0.36, 1.2] },
  { position: [0.38, 0.094, 0.11], scale: [1.2, 0.28, 1.0] },
  { position: [-0.24, 0.094, 0.18], scale: [1.1, 0.26, 0.9] },
] as const;

export function HeatRays({ color }: { color: string }) {
  const groupRef = useRef<Group>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    const pulse = 1 + Math.sin(advance(delta) * 3.4) * 0.08;
    groupRef.current.scale.setScalar(pulse);
  });

  return (
    <CameraBounds motion={{ scale: 1.08 }} objectRef={groupRef}>
      {Arr.map(HEAT_RAY_OFFSETS, (x) => (
        <group key={x} position={[x, 0.36, 0]} rotation={[0, 0, -x * 1.1]}>
          <mesh>
            <latheGeometry args={[FLAME_TEARDROP_PROFILE, 28]} />
            <meshStandardMaterial
              color={color}
              depthWrite={false}
              emissive={color}
              emissiveIntensity={0.85}
              opacity={0.56}
              roughness={0.18}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.015, 0]} scale={[0.56, 0.62, 0.56]}>
            <latheGeometry args={[FLAME_TEARDROP_PROFILE, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.8}
              roughness={0.12}
            />
          </mesh>
        </group>
      ))}
    </CameraBounds>
  );
}

export function RustPatches({ color }: { color: string }) {
  return (
    <group>
      {Arr.map(RUST_PATCHES, (patch) => (
        <mesh
          castShadow
          key={Arr.join(Arr.map(patch.position, String), ",")}
          position={patch.position}
          receiveShadow
          scale={patch.scale}
        >
          <dodecahedronGeometry args={[0.06, 1]} />
          <meshStandardMaterial color={color} roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

export function FloatingIons() {
  const { colors } = useChemicalReactionTypeScene();
  const groupRef = useRef<Group>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y = advance(delta) * 0.38;
  });

  return (
    <CameraBounds motion={{ rotation: "y" }} objectRef={groupRef}>
      <ParticleElementContext
        value={{ color: colors.calcium, label: "", radius: 0.07 }}
      >
        {Arr.map(FLOATING_ION_POINTS, (point) => (
          <Particle
            key={Arr.join(Arr.map(point, String), ",")}
            position={point}
          />
        ))}
      </ParticleElementContext>
    </CameraBounds>
  );
}

export function SettledSolid() {
  const { colors } = useChemicalReactionTypeScene();
  return (
    <ParticleElementContext
      value={{
        color: colors.precipitate,
        label: "",
        radius: SETTLED_SOLID_RADIUS,
      }}
    >
      <group>
        {Arr.map(SETTLED_SOLID_POINTS, (point) => (
          <Particle
            key={Arr.join(Arr.map(point, String), ",")}
            position={point}
          />
        ))}
      </group>
    </ParticleElementContext>
  );
}

export function GasBubbles() {
  return (
    <CameraBounds bounds={BUBBLE_BOUNDS}>
      {Arr.map(BUBBLES, (bubble) => (
        <AnimatedBubble
          key={Arr.join(Arr.map(bubble.position, String), ",")}
          {...bubble}
        />
      ))}
    </CameraBounds>
  );
}

function AnimatedBubble({ phase, position, speed }: GasBubble) {
  const color = useChemicalReactionTypeScene().colors.bubble;
  const meshRef = useRef<Mesh>(null);
  const { advance } = useSimulationClock(0);
  const [x, y, z] = position;

  useFrame((_, delta) => {
    if (!meshRef.current) {
      return;
    }

    const elapsed = advance(delta);
    const progress = (elapsed * speed + phase) % 1;
    meshRef.current.position.x =
      x + Math.sin(elapsed * 2.6 + phase * Math.PI * 2) * 0.018;
    meshRef.current.position.y = y + progress * BUBBLE_TRAVEL;
    meshRef.current.scale.setScalar(
      BUBBLE_INITIAL_SCALE + progress * BUBBLE_GROWTH
    );
  });

  return (
    <mesh position={[x, y, z]} ref={meshRef}>
      <sphereGeometry args={[BUBBLE_RADIUS, 28, 20]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.05}
        color={color}
        opacity={0.56}
        roughness={0.08}
        transparent
      />
    </mesh>
  );
}
