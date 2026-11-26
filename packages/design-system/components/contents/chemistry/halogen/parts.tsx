import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import { createTestTubeGeometry } from "@repo/design-system/components/contents/chemistry/halogen/geometry";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import type { Group, Mesh } from "three";

export const DROP_START_Y = 0.214;
export const ORGANIC_TOP_Y = 0.158;
const INTERFACE_Y = 0.1055;

export const HALIDE_IONS = [
  { id: "ion-0", x: -0.008, y: 0.052, z: 0.006 },
  { id: "ion-1", x: 0.007, y: 0.068, z: -0.005 },
  { id: "ion-2", x: -0.004, y: 0.084, z: -0.007 },
  { id: "ion-3", x: 0.008, y: 0.044, z: 0.004 },
] as const;

export const HALOGEN_PAIRS = [
  { id: "pair-0", offset: 0, x: -0.005, z: 0.004 },
  { id: "pair-1", offset: 0.34, x: 0.006, z: -0.004 },
  { id: "pair-2", offset: 0.68, x: 0.001, z: 0.006 },
] as const;

export function resetHalogenPairs(group: Group | null, displaced: boolean) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const spec = HALOGEN_PAIRS[i];
    if (child !== undefined && spec !== undefined) {
      const startY = displaced ? 0.072 + spec.offset * 0.072 : 0.132;
      child.position.set(spec.x, startY, spec.z);
    }
  }
}

export function stepDroplet(drop: Mesh | null, ripple: Mesh | null, t: number) {
  if (drop !== null) {
    if (t < 0.78) {
      const fall = (t / 0.78) ** 1.6;
      drop.position.set(
        0,
        DROP_START_Y - fall * (DROP_START_Y - ORGANIC_TOP_Y),
        0
      );
      drop.scale.set(1, 1 + fall * 0.2, 1);
    } else {
      drop.position.set(0, DROP_START_Y, 0);
      const swell = (t - 0.78) / 0.22;
      drop.scale.setScalar(0.35 + swell * 0.65);
    }
  }
  if (ripple === null) {
    return;
  }
  if (t >= 0.74) {
    const wave = (t - 0.74) / 0.26;
    const scale = 0.25 + wave * 1.15;
    ripple.visible = true;
    ripple.scale.set(scale, scale, 1);
  } else {
    ripple.visible = false;
  }
}

export function stepHalogenPairs(
  group: Group | null,
  phase: number,
  displaced: boolean
) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const spec = HALOGEN_PAIRS[i];
    if (child === undefined || spec === undefined) {
      continue;
    }
    if (displaced) {
      const u = (phase * 0.42 + spec.offset) % 1;
      child.position.set(
        spec.x + Math.sin(phase * 3 + i) * 0.002,
        0.072 + u * 0.074,
        spec.z
      );
    } else {
      child.position.set(
        spec.x + Math.sin(phase * 2 + i) * 0.0014,
        0.132 + Math.cos(phase * 2 + i) * 0.002,
        spec.z
      );
    }
  }
}

export function stepHalideIons(group: Group | null, phase: number) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const ion = HALIDE_IONS[i];
    if (child !== undefined && ion !== undefined) {
      child.position.set(
        ion.x + Math.sin(phase * 2.2 + i * 1.7) * 0.0016,
        ion.y + Math.cos(phase * 2.6 + i) * 0.002,
        ion.z
      );
    }
  }
}

/** Turned round-bottom borosilicate test tube holding immiscible aqueous and organic layers. */
export function TwoLayerTestTube({
  aqueousHex,
  children,
  organicHex,
}: {
  readonly aqueousHex: string;
  readonly children: ReactNode;
  readonly organicHex: string;
}) {
  const tubeGeo = useMemo(createTestTubeGeometry, []);
  useEffect(() => () => tubeGeo.dispose(), [tubeGeo]);

  return (
    <group>
      {/* Lower aqueous halide layer: hemispherical bottom + column meniscus */}
      <mesh position={[0, 0.033, 0]}>
        <sphereGeometry
          args={[0.0185, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
        />
        <LiquidMaterial color={aqueousHex} opacity={0.68} />
      </mesh>
      <ColumnLiquid
        bottom={0.033}
        color={aqueousHex}
        level={0.105}
        opacity={0.68}
        radius={0.0185}
      />

      {/* Upper organic cyclohexane layer resting sharply atop aqueous meniscus */}
      <mesh position={[0, (INTERFACE_Y + ORGANIC_TOP_Y) / 2, 0]}>
        <cylinderGeometry
          args={[0.0184, 0.0184, ORGANIC_TOP_Y - INTERFACE_Y, 44]}
        />
        <meshPhysicalMaterial
          clearcoat={0.75}
          clearcoatRoughness={0.12}
          color={organicHex}
          emissive={organicHex}
          emissiveIntensity={0.28}
          opacity={0.95}
          roughness={0.16}
          transparent
        />
      </mesh>
      {/* Refractive liquid-liquid phase boundary ring */}
      <mesh position={[0, INTERFACE_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0184, 0.0008, 10, 48]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.78} />
      </mesh>

      {children}

      {/* Turned borosilicate glass wall and flared pouring lip */}
      <mesh castShadow geometry={tubeGeo} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.13} />
      </mesh>
      <mesh position={[0, 0.205, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.024, 0.0011, 10, 48]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.62} />
      </mesh>
    </group>
  );
}
