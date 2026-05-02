import { useFrame } from "@react-three/fiber";
import type {
  ChemicalReactionTypeSceneColors,
  ChemicalReactionTypeScenePoint,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  BEAKER_CONTENT_BOTTOM_Y,
  Particle,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/parts";
import { useRef } from "react";
import type { Group, Mesh } from "three";

const FLOATING_ION_POINTS = [
  [-0.18, -0.2, 0.08],
  [0.16, -0.18, -0.06],
  [0, 0.02, 0.1],
] satisfies ChemicalReactionTypeScenePoint[];

const BUBBLES = [
  { phase: 0.08, position: [-0.16, -0.28, 0.08], speed: 0.34 },
  { phase: 0.27, position: [0.02, -0.36, -0.08], speed: 0.4 },
  { phase: 0.49, position: [0.18, -0.2, 0.04], speed: 0.37 },
  { phase: 0.71, position: [-0.03, -0.1, 0.1], speed: 0.44 },
] satisfies GasBubble[];

const BUBBLE_RADIUS = 0.055;
const SETTLED_SOLID_RADIUS = 0.055;
const SETTLED_SOLID_BASE_Y =
  BEAKER_CONTENT_BOTTOM_Y + SETTLED_SOLID_RADIUS + 0.02;

const SETTLED_SOLID_POINTS = [
  [-0.18, SETTLED_SOLID_BASE_Y, 0.02],
  [-0.07, SETTLED_SOLID_BASE_Y - 0.01, -0.04],
  [0.06, SETTLED_SOLID_BASE_Y, 0.04],
  [0.18, SETTLED_SOLID_BASE_Y + 0.01, -0.02],
  [-0.01, SETTLED_SOLID_BASE_Y + 0.09, 0.01],
] satisfies ChemicalReactionTypeScenePoint[];

interface GasBubble {
  phase: number;
  position: ChemicalReactionTypeScenePoint;
  speed: number;
}

export function HeatRays({ color }: { color: string }) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    const pulse = 1 + Math.sin(clock.elapsedTime * 3.4) * 0.08;
    groupRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef}>
      {[-0.28, 0, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.56, 0]} rotation={[0, 0, x * 2]}>
          <coneGeometry args={[0.05, 0.34, 16]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
      ))}
    </group>
  );
}

export function RustPatches({ color }: { color: string }) {
  return (
    <group position={[0, 0.12, 0.02]}>
      {[-0.34, -0.08, 0.2, 0.38].map((x) => (
        <mesh key={x} position={[x, 0.02, 0]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function FloatingIons({
  colors,
}: {
  colors: ChemicalReactionTypeSceneColors;
}) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.38;
  });

  return (
    <group ref={groupRef}>
      {FLOATING_ION_POINTS.map((point) => (
        <Particle
          color={colors.calcium}
          key={point.join(",")}
          label=""
          labelColor={colors.sphereText}
          labelOutlineColor={colors.sphereTextOutline}
          position={point}
          radius={0.07}
        />
      ))}
    </group>
  );
}

export function SettledSolid({
  colors,
}: {
  colors: ChemicalReactionTypeSceneColors;
}) {
  return (
    <group>
      {SETTLED_SOLID_POINTS.map((point) => (
        <Particle
          color={colors.precipitate}
          key={point.join(",")}
          label=""
          labelColor={colors.text}
          labelOutlineColor={colors.sphereTextOutline}
          position={point}
          radius={SETTLED_SOLID_RADIUS}
        />
      ))}
    </group>
  );
}

export function GasBubbles({ color }: { color: string }) {
  return (
    <group>
      {BUBBLES.map((bubble) => (
        <AnimatedBubble
          color={color}
          key={bubble.position.join(",")}
          {...bubble}
        />
      ))}
    </group>
  );
}

function AnimatedBubble({
  color,
  phase,
  position,
  speed,
}: GasBubble & { color: string }) {
  const meshRef = useRef<Mesh>(null);
  const [x, y, z] = position;

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    const progress = (clock.elapsedTime * speed + phase) % 1;
    meshRef.current.position.y = y + progress * 0.56;
    meshRef.current.scale.setScalar(0.82 + progress * 0.36);
  });

  return (
    <mesh position={[x, y, z]} ref={meshRef}>
      <sphereGeometry args={[BUBBLE_RADIUS, 24, 16]} />
      <meshStandardMaterial
        color={color}
        opacity={0.36}
        roughness={0.1}
        transparent
      />
    </mesh>
  );
}
