import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";

/** The plates: their radius and thickness, in scene units of a millimetre. */
export const PLATE = { radius: 3.4, thick: 0.24 } as const;

/** How far the bench lies under the lower plate. */
const BENCH_DROP = 2.2;

/** A machined brass plate in section, its inner face at y = 0: a flat disc with a chamfered rim. */
const PLATE_PROFILE = [
  [0, 0],
  [PLATE.radius - 0.05, 0],
  [PLATE.radius, 0.05],
  [PLATE.radius, PLATE.thick - 0.05],
  [PLATE.radius - 0.05, PLATE.thick],
  [0.001, PLATE.thick],
] as const;

/** The upper plate, with the pinhole in its middle the oil mist falls through. */
const PIERCED_PROFILE = [
  [0.07, 0],
  [PLATE.radius - 0.05, 0],
  [PLATE.radius, 0.05],
  [PLATE.radius, PLATE.thick - 0.05],
  [PLATE.radius - 0.05, PLATE.thick],
  [0.16, PLATE.thick],
  [0.07, PLATE.thick - 0.08],
] as const;

/** The turned pedestal that carries the lower plate over the bench. */
const PEDESTAL = [
  [0, 0],
  [1.5, 0],
  [1.55, 0.06],
  [1.55, 0.2],
  [0.6, 0.34],
  [0.42, 0.5],
  [0.42, BENCH_DROP - 0.2],
  [0.8, BENCH_DROP - 0.06],
  [0.8, BENCH_DROP],
  [0.001, BENCH_DROP],
] as const;

/** Where the three insulating spacers stand round the plates, as angles. */
const SPACERS = [
  0.6,
  0.6 + (Math.PI * 2) / 3,
  0.6 + (Math.PI * 4) / 3,
] as const;

/**
 * Millikan's condenser on the bench: two machined brass plates `gap` apart,
 * held by three ebonite spacers inside a glass ring that keeps draughts off
 * the drops, the upper plate pierced by the pinhole the oil mist falls
 * through, each plate with its binding post and lead, the lower one on a
 * turned pedestal. The gap's middle is at y = 0.
 */
export function Chamber({ gap }: { readonly gap: number }) {
  const posts = [
    { color: BENCH_COLORS.leadRed, y: gap / 2 + PLATE.thick / 2 },
    { color: BENCH_COLORS.leadBlack, y: -gap / 2 - PLATE.thick / 2 },
  ] as const;
  return (
    <group>
      <mesh castShadow position={[0, gap / 2, 0]} receiveShadow>
        <Turn profile={PIERCED_PROFILE} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
      </mesh>
      <mesh
        castShadow
        position={[0, -gap / 2, 0]}
        receiveShadow
        rotation={[Math.PI, 0, 0]}
      >
        <Turn profile={PLATE_PROFILE} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
      </mesh>
      <mesh
        castShadow
        position={[0, -gap / 2 - PLATE.thick - BENCH_DROP, 0]}
        receiveShadow
      >
        <Turn profile={PEDESTAL} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          color={INSTRUMENT_COLORS.anodised}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      {Arr.map(SPACERS, (angle) => (
        <mesh
          castShadow
          key={angle}
          position={[
            Math.cos(angle) * (PLATE.radius - 0.42),
            0,
            -Math.abs(Math.sin(angle)) * (PLATE.radius - 0.42),
          ]}
        >
          <cylinderGeometry args={[0.16, 0.16, gap, 32]} />
          <meshPhysicalMaterial
            clearcoat={0.7}
            color={BENCH_COLORS.bottleCap}
            roughness={0.35}
          />
        </mesh>
      ))}
      <mesh renderOrder={2}>
        <cylinderGeometry
          args={[PLATE.radius - 0.12, PLATE.radius - 0.12, gap, 96, 1, true]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.1} />
      </mesh>
      {Arr.map(posts, (post) => (
        <group key={post.y} position={[PLATE.radius, post.y, 0]}>
          <mesh
            castShadow
            position={[0.2, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.1, 0.1, 0.4, 24]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
          </mesh>
          <mesh
            castShadow
            position={[0.48, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.15, 0.15, 0.26, 24]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={post.color}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
