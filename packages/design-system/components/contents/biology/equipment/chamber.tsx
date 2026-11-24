import { RoundedBox } from "@react-three/drei";
import {
  BENCH_TOP,
  PLACES,
  WALLS,
} from "@repo/design-system/components/contents/biology/equipment/places";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";

/** The chamber's sides, its back against the wall, its front frame and its top, in metres. */
const SPAN = {
  back: WALLS.back + 0.015,
  front: PLACES.fumeChamber.base[2] + PLACES.fumeChamber.size[2] / 2,
  left: PLACES.fumeChamber.base[0] - PLACES.fumeChamber.size[0] / 2,
  right: PLACES.fumeChamber.base[0] + PLACES.fumeChamber.size[0] / 2,
  top: PLACES.fumeChamber.size[1],
} as const;

/** How thick the chamber's side panels are. */
const SIDE = 0.05;

/** Where the enclosure ends and its top housing begins, in metres above the floor. */
const ROOF = 2.1;

/**
 * How far the sash stands open above the worktop: 300 mm, below the 500 mm
 * mark at which a standard fume cupboard's face velocity is checked
 * (0.5 m/s), as a learner working inside keeps it.
 *
 * @see https://www.nottingham.ac.uk/safety/documents/fume-cupboard-maintenance.pdf
 */
const SASH_OPEN = 0.3;

/** The highest sash opening the yellow marks on its tracks allow. */
const SASH_MARK = 0.5;

/** The sash's height, glass and frame. */
const SASH = 0.62;

/**
 * A fume chamber at the bench's right: a cabinet under an epoxy work tray,
 * an enclosure of powder-coated steel lit from its roof, a stainless
 * aerofoil sill, a glass sash drawn down to 300 mm, and the duct that
 * carries the air up and out of the room.
 */
export function FumeChamber() {
  const middle = (SPAN.left + SPAN.right) / 2;
  const width = SPAN.right - SPAN.left;
  const depth = SPAN.front - SPAN.back;
  const inner = width - 2 * SIDE;
  const sashBottom = BENCH_TOP + SASH_OPEN;
  return (
    <group>
      <mesh
        castShadow
        position={[
          middle,
          (BENCH_TOP - 0.04) / 2,
          SPAN.back + (depth - 0.06) / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[width, BENCH_TOP - 0.04, depth - 0.06]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.chamber}
          roughness={0.5}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group
          key={side}
          position={[
            middle + side * (width / 4),
            0.45,
            SPAN.front - 0.06 + 0.009,
          ]}
        >
          <mesh receiveShadow>
            <boxGeometry args={[width / 2 - 0.008, 0.76, 0.018]} />
            <meshPhysicalMaterial
              clearcoat={0.3}
              color={LABORATORY_COLORS.chamber}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[-side * (width / 4 - 0.05), 0.28, 0.016]}>
            <boxGeometry args={[0.012, 0.12, 0.012]} />
            <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh
        castShadow
        position={[middle, BENCH_TOP - 0.02, SPAN.back + depth / 2]}
        receiveShadow
      >
        <boxGeometry args={[width, 0.04, depth]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={LABORATORY_COLORS.worktop}
          roughness={0.5}
        />
      </mesh>
      {Arr.map([SPAN.left + SIDE / 2, SPAN.right - SIDE / 2] as const, (x) => (
        <mesh
          castShadow
          key={x}
          position={[x, (BENCH_TOP + SPAN.top) / 2, SPAN.back + depth / 2]}
          receiveShadow
        >
          <boxGeometry args={[SIDE, SPAN.top - BENCH_TOP, depth]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={LABORATORY_COLORS.chamber}
            roughness={0.45}
          />
        </mesh>
      ))}
      <mesh
        position={[middle, (BENCH_TOP + ROOF) / 2, SPAN.back + 0.01]}
        receiveShadow
      >
        <boxGeometry args={[inner, ROOF - BENCH_TOP, 0.02]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.chamberInside}
          roughness={0.6}
        />
      </mesh>
      <mesh
        castShadow
        position={[middle, (ROOF + SPAN.top) / 2, SPAN.back + depth / 2]}
      >
        <boxGeometry args={[inner, SPAN.top - ROOF, depth]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={LABORATORY_COLORS.chamber}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[middle, ROOF - 0.006, SPAN.back + depth / 2 - 0.05]}>
        <boxGeometry args={[inner * 0.7, 0.01, 0.12]} />
        <meshBasicMaterial color={LABORATORY_COLORS.cross} toneMapped={false} />
      </mesh>
      <mesh
        position={[SPAN.right - SIDE - 0.08, ROOF + 0.15, SPAN.front + 0.001]}
      >
        <planeGeometry args={[0.07, 0.035]} />
        <meshStandardMaterial
          color={BENCH_COLORS.lcd}
          emissive={BENCH_COLORS.lcdInk}
          emissiveIntensity={0.25}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[middle, SPAN.top + 0.25, SPAN.back + depth / 2 - 0.1]}>
        <cylinderGeometry args={[0.125, 0.125, 0.5, 40]} />
        <MetalMaterial color={LABORATORY_COLORS.duct} roughness={0.45} />
      </mesh>
      <RoundedBox
        args={[inner, 0.02, 0.06]}
        castShadow
        position={[middle, BENCH_TOP + 0.01, SPAN.front - 0.03]}
        radius={0.009}
      >
        <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.28} />
      </RoundedBox>
      {Arr.map(
        [SPAN.left + SIDE - 0.012, SPAN.right - SIDE + 0.012] as const,
        (x) => (
          <group key={x}>
            <mesh
              castShadow
              position={[x, (BENCH_TOP + ROOF) / 2, SPAN.front + 0.01]}
            >
              <boxGeometry args={[0.024, ROOF - BENCH_TOP, 0.02]} />
              <MetalMaterial
                color={LABORATORY_COLORS.chamberFrame}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[x, BENCH_TOP + SASH_MARK, SPAN.front + 0.0205]}>
              <boxGeometry args={[0.024, 0.008, 0.002]} />
              <meshStandardMaterial
                color={LABORATORY_COLORS.capYellow}
                roughness={0.5}
              />
            </mesh>
          </group>
        )
      )}
      <group position={[middle, sashBottom + SASH / 2, SPAN.front - 0.015]}>
        <mesh>
          <boxGeometry args={[inner - 0.05, SASH - 0.04, 0.006]} />
          <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.18} />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            position={[0, side * (SASH / 2 - 0.012), 0]}
          >
            <boxGeometry args={[inner - 0.05, 0.024, 0.02]} />
            <MetalMaterial
              color={LABORATORY_COLORS.chamberFrame}
              roughness={0.35}
            />
          </mesh>
        ))}
        <mesh
          castShadow
          position={[0, -SASH / 2 + 0.01, 0.022]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.009, 0.009, inner * 0.8, 16]} />
          <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.18} />
        </mesh>
      </group>
      <mesh
        position={[middle, (sashBottom + SASH + ROOF) / 2, SPAN.front - 0.004]}
      >
        <boxGeometry args={[inner - 0.048, ROOF - sashBottom - SASH, 0.008]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={LABORATORY_COLORS.chamber}
          roughness={0.45}
        />
      </mesh>
      <group position={[middle - 0.2, BENCH_TOP, SPAN.back + 0.25]}>
        <mesh castShadow position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.035, 0.038, 0.14, 32]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={BENCH_COLORS.bottleAmber}
            roughness={0.15}
          />
        </mesh>
        <mesh position={[0, 0.155, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.03, 20]} />
          <meshStandardMaterial
            color={BENCH_COLORS.bottleCap}
            roughness={0.6}
          />
        </mesh>
      </group>
    </group>
  );
}
