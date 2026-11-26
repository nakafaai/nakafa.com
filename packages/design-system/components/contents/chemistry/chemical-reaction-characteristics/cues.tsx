import { useFrame } from "@react-three/fiber";
import { useReactionCharacteristicsColors } from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/context";
import { ReactionScenePointSchema } from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr, Schema } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { Vector2 } from "three";

export const BEAKER_WALL_HEIGHT = 1.34;
export const LIQUID_HEIGHT = 0.68;
export const LIQUID_BOTTOM_Y = -BEAKER_WALL_HEIGHT / 2 + 0.04;
export const LIQUID_TOP_Y = LIQUID_BOTTOM_Y + LIQUID_HEIGHT;

const BUBBLE_RADIUS = 0.042;
const BUBBLE_RISE = 0.62;
const BUBBLE_INITIAL_SCALE = 0.65;
const BUBBLE_GROWTH = 0.45;
const SOLID_RADIUS = 0.048;
const COLOR_PARTICLE_RADIUS = 0.046;

const ReactionParticleSchema = Schema.Struct({
  id: Schema.String,
  phase: Schema.optionalKey(Schema.Finite),
  position: ReactionScenePointSchema,
  speed: Schema.optionalKey(Schema.Finite),
});

type ReactionParticle = typeof ReactionParticleSchema.Type;

/** Settled precipitate sediment mound resting on the beaker floor. */
const SEDIMENT_MOUND_PROFILE = Arr.map(
  [
    [0.001, LIQUID_BOTTOM_Y + 0.085],
    [0.12, LIQUID_BOTTOM_Y + 0.072],
    [0.24, LIQUID_BOTTOM_Y + 0.046],
    [0.34, LIQUID_BOTTOM_Y + 0.016],
    [0.365, LIQUID_BOTTOM_Y],
    [0.001, LIQUID_BOTTOM_Y],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

const BUBBLES = [
  { id: "b-1", phase: 0.04, position: [-0.21, -0.52, 0.09], speed: 0.36 },
  { id: "b-2", phase: 0.14, position: [-0.07, -0.54, -0.11], speed: 0.44 },
  { id: "b-3", phase: 0.23, position: [0.09, -0.5, 0.13], speed: 0.39 },
  { id: "b-4", phase: 0.34, position: [0.22, -0.53, -0.05], speed: 0.42 },
  { id: "b-5", phase: 0.46, position: [-0.15, -0.44, -0.14], speed: 0.35 },
  { id: "b-6", phase: 0.58, position: [0.02, -0.48, 0.04], speed: 0.48 },
  { id: "b-7", phase: 0.69, position: [0.16, -0.42, 0.11], speed: 0.37 },
  { id: "b-8", phase: 0.81, position: [-0.04, -0.46, -0.02], speed: 0.41 },
  { id: "b-9", phase: 0.91, position: [-0.24, -0.47, -0.02], speed: 0.38 },
  { id: "b-10", phase: 0.29, position: [0.13, -0.51, -0.16], speed: 0.45 },
] satisfies ReactionParticle[];

const PRECIPITATE_PARTICLES = [
  { id: "solid-1", position: [-0.22, -0.58, 0.06], scale: 1.05 },
  { id: "solid-2", position: [-0.12, -0.57, -0.09], scale: 0.9 },
  { id: "solid-3", position: [0.01, -0.56, 0.12], scale: 1.1 },
  { id: "solid-4", position: [0.14, -0.58, -0.04], scale: 0.95 },
  { id: "solid-5", position: [0.23, -0.58, 0.08], scale: 0.85 },
  { id: "solid-6", position: [-0.06, -0.54, 0.02], scale: 1 },
  { id: "solid-7", position: [0.08, -0.55, 0.04], scale: 0.88 },
  { id: "solid-8", position: [-0.15, -0.57, 0.14], scale: 0.76 },
  { id: "solid-9", position: [0.02, -0.56, -0.13], scale: 0.82 },
] as const;

const COLOR_PARTICLES = [
  {
    id: "color-left",
    phase: 0.12,
    position: [-0.22, -0.32, 0.12],
    speed: 0.45,
  },
  {
    id: "color-center-left",
    phase: 0.3,
    position: [-0.06, -0.18, -0.1],
    speed: 0.4,
  },
  {
    id: "color-center-right",
    phase: 0.56,
    position: [0.12, -0.28, 0.08],
    speed: 0.42,
  },
  {
    id: "color-right",
    phase: 0.78,
    position: [0.24, -0.12, -0.04],
    speed: 0.36,
  },
  {
    id: "color-low",
    phase: 0.44,
    position: [-0.14, -0.44, -0.06],
    speed: 0.38,
  },
  {
    id: "color-high",
    phase: 0.64,
    position: [0.04, -0.08, 0.14],
    speed: 0.41,
  },
] satisfies ReactionParticle[];

const STEAM_WISPS = [
  { id: "steam-1", phase: 0, x: -0.16, z: 0.04 },
  { id: "steam-2", phase: 0.25, x: 0.02, z: -0.08 },
  { id: "steam-3", phase: 0.5, x: 0.15, z: 0.06 },
  { id: "steam-4", phase: 0.75, x: -0.05, z: 0.1 },
] as const;

/** Animates effervescent gas bubbles rising through the product solution. */
export function GasBubbles() {
  return (
    <group>
      {Arr.map(BUBBLES, (bubble) => (
        <AnimatedBubble key={bubble.id} particle={bubble} />
      ))}
    </group>
  );
}

/** Renders one glossy bubble with looping vertical motion and gentle lateral sway. */
function AnimatedBubble({ particle }: { particle: ReactionParticle }) {
  const color = useReactionCharacteristicsColors().bubble;
  const bubbleRef = useRef<Group>(null);
  const { advance } = useSimulationClock(0);
  const [x, y, z] = particle.position;
  const speed = particle.speed ?? 0.35;
  const phase = particle.phase ?? 0;

  useFrame((_, delta) => {
    if (!bubbleRef.current) {
      return;
    }

    const elapsed = advance(delta);
    const progress = (elapsed * speed + phase) % 1;
    const sway = Math.sin(elapsed * 2.8 + phase * Math.PI * 2) * 0.022;
    bubbleRef.current.position.set(x + sway, y + progress * BUBBLE_RISE, z);
    bubbleRef.current.scale.setScalar(
      BUBBLE_INITIAL_SCALE + progress * BUBBLE_GROWTH
    );
  });

  return (
    <CameraBounds
      motion={{
        scale: BUBBLE_INITIAL_SCALE + BUBBLE_GROWTH,
        translation: {
          x: { min: x - 0.022, max: x + 0.022 },
          y: { min: y, max: y + BUBBLE_RISE },
          z: { min: z, max: z },
        },
      }}
      objectRef={bubbleRef}
    >
      <mesh>
        <sphereGeometry args={[BUBBLE_RADIUS, 28, 20]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={color}
          opacity={0.58}
          roughness={0.06}
          transparent
        />
      </mesh>
    </CameraBounds>
  );
}

/** Shows insoluble crystalline sediment settled in a realistic layer on the beaker bottom. */
export function Precipitate({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[SEDIMENT_MOUND_PROFILE, 48]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      {Arr.map(PRECIPITATE_PARTICLES, (particle) => (
        <mesh
          castShadow
          key={particle.id}
          position={particle.position}
          receiveShadow
          scale={particle.scale}
        >
          <dodecahedronGeometry args={[SOLID_RADIUS, 1]} />
          <meshStandardMaterial color={color} roughness={0.68} />
        </mesh>
      ))}
    </group>
  );
}

/** Shows the product color as suspended pigment particles swirling through the liquid. */
export function ColorParticles({ color }: { color: string }) {
  const groupRef = useRef<Group>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y = advance(delta) * 0.35;
  });

  return (
    <CameraBounds motion={{ rotation: "y" }} objectRef={groupRef}>
      {Arr.map(COLOR_PARTICLES, (particle) => (
        <mesh castShadow key={particle.id} position={particle.position}>
          <sphereGeometry args={[COLOR_PARTICLE_RADIUS, 24, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.55}
            color={color}
            emissive={color}
            emissiveIntensity={0.14}
            roughness={0.26}
          />
        </mesh>
      ))}
    </CameraBounds>
  );
}

/**
 * Glass laboratory thermometer resting diagonally inside the beaker: a low
 * alcohol column before the reaction and a risen glowing column when warmed.
 */
export function LabThermometer({
  color,
  warm,
}: {
  readonly color: string;
  readonly warm: boolean;
}) {
  const columnHeight = warm ? 0.92 : 0.36;
  const columnRef = useRef<Group>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!(warm && columnRef.current)) {
      return;
    }
    const pulse = 1 + Math.sin(advance(delta) * 2.6) * 0.04;
    columnRef.current.scale.y = pulse;
  });

  return (
    <group position={[0.12, 0.16, 0]} rotation={[0, 0, -0.22]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.032, 0.032, 1.48, 24]} />
        <GlassMaterial color={getColor("SLATE", 200)} opacity={0.34} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <torusGeometry args={[0.026, 0.006, 10, 24]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.05, -0.012]}>
        <boxGeometry args={[0.026, 1.18, 0.006]} />
        <meshStandardMaterial color={getColor("WHITE")} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.74, 0]}>
        <sphereGeometry args={[0.054, 24, 18]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={color}
          emissive={color}
          emissiveIntensity={warm ? 0.45 : 0.05}
          roughness={0.14}
        />
      </mesh>
      <group position={[0, -0.7, 0.006]} ref={columnRef}>
        <mesh position={[0, columnHeight / 2, 0]}>
          <cylinderGeometry args={[0.012, 0.012, columnHeight, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={warm ? 0.5 : 0.08}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Soft rising white vapor wisps drifting above the warmed product solution. */
export function ThermalSteam() {
  return (
    <group>
      {Arr.map(STEAM_WISPS, (wisp) => (
        <SteamWisp key={wisp.id} wisp={wisp} />
      ))}
    </group>
  );
}

function SteamWisp({ wisp }: { readonly wisp: (typeof STEAM_WISPS)[number] }) {
  const ref = useRef<Group>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }
    const t = (advance(delta) * 0.42 + wisp.phase) % 1;
    const sway = Math.sin(t * Math.PI * 2 + wisp.phase * 6) * 0.045;
    ref.current.position.set(
      wisp.x + sway,
      LIQUID_TOP_Y + 0.1 + t * 0.56,
      wisp.z
    );
    ref.current.scale.setScalar(0.45 + t * 0.75);
  });

  return (
    <CameraBounds exclude objectRef={ref}>
      <mesh>
        <sphereGeometry args={[0.055, 18, 14]} />
        <meshStandardMaterial
          color={getColor("WHITE")}
          depthWrite={false}
          opacity={0.28}
          roughness={0.92}
          transparent
        />
      </mesh>
    </CameraBounds>
  );
}
