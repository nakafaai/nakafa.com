import { RoundedBox } from "@react-three/drei";
import {
  BASE_HEIGHT,
  BOARD_TOP,
  PARTS,
  POST,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LOGIC_COLORS } from "@repo/design-system/lib/material/logic";
import { Array as Arr } from "effect";

/**
 * Lacquered brass, as on terminal posts and switch blades: a little less
 * than bare metal, so it keeps its warm yellow under the room's light instead
 * of mirroring the dark desk.
 */
export function BrassMaterial({
  roughness = 0.32,
}: {
  readonly roughness?: number;
}) {
  return (
    <meshPhysicalMaterial
      clearcoat={0.4}
      clearcoatRoughness={0.2}
      color={LOGIC_COLORS.brass}
      metalness={0.75}
      roughness={roughness}
    />
  );
}

/** The top face of every part's base. */
export const BASE_TOP = BOARD_TOP + BASE_HEIGHT;

/** The black phenolic base a part is screwed to, `length` along x and `depth` along z. */
export function PartBase({
  depth,
  length,
}: {
  readonly depth: number;
  readonly length: number;
}) {
  return (
    <RoundedBox
      args={[length, BASE_HEIGHT, depth]}
      castShadow
      position={[0, BOARD_TOP + BASE_HEIGHT / 2, 0]}
      radius={0.0018}
      receiveShadow
      smoothness={3}
    >
      <meshPhysicalMaterial
        clearcoat={0.4}
        clearcoatRoughness={0.3}
        color={LOGIC_COLORS.bakelite}
        roughness={0.45}
      />
    </RoundedBox>
  );
}

/**
 * A 4 mm brass terminal post with its knurled nut, standing on a base at
 * `x`; the cell holder's posts wear a red or black collar for + and -.
 */
export function Post({
  collar,
  x,
}: {
  readonly collar?: "red" | "black";
  readonly x: number;
}) {
  return (
    <group position={[x, BASE_TOP, 0]}>
      <mesh castShadow position={[0, POST.height / 2, 0]}>
        <cylinderGeometry
          args={[POST.radius * 0.55, POST.radius * 0.55, POST.height, 16]}
        />
        <BrassMaterial roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, POST.height - 0.0018, 0]}>
        <cylinderGeometry args={[POST.radius, POST.radius, 0.0036, 18]} />
        <BrassMaterial roughness={0.42} />
      </mesh>
      {collar === undefined ? null : (
        <mesh castShadow position={[0, 0.0016, 0]}>
          <cylinderGeometry
            args={[POST.radius * 1.35, POST.radius * 1.45, 0.0032, 20]}
          />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={
              collar === "red"
                ? LOGIC_COLORS.collarRed
                : LOGIC_COLORS.collarBlack
            }
            roughness={0.35}
          />
        </mesh>
      )}
    </group>
  );
}

/** An AA cell: its radius and its length, in metres. */
const CELL = { length: 0.0505, radius: 0.007_25 } as const;

/**
 * Two AA cells end to end in a black holder, 3 V together, the positive end
 * of the pair toward post a. The posts stand on the base beyond the holder.
 */
export function BatteryHolder() {
  const { depth, length, reach } = PARTS.battery;
  const trough = CELL.length * 2 + 0.006;
  const axis = BASE_TOP + CELL.radius + 0.0012;
  return (
    <group>
      <PartBase depth={depth} length={length} />
      <mesh castShadow position={[0, BASE_TOP + 0.005, 0]} receiveShadow>
        <boxGeometry args={[trough, 0.01, CELL.radius * 2 + 0.005]} />
        <meshStandardMaterial color={LOGIC_COLORS.holder} roughness={0.6} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group
          key={side}
          position={[(side * CELL.length) / 2, axis, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry
              args={[CELL.radius, CELL.radius, CELL.length - 0.002, 32]}
            />
            <meshPhysicalMaterial
              clearcoat={0.7}
              clearcoatRoughness={0.2}
              color={LOGIC_COLORS.cellWrap}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, CELL.length * 0.18, 0]}>
            <cylinderGeometry
              args={[
                CELL.radius + 0.0001,
                CELL.radius + 0.0001,
                CELL.length * 0.12,
                32,
              ]}
            />
            <meshPhysicalMaterial
              clearcoat={0.7}
              color={LOGIC_COLORS.cellBand}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, CELL.length / 2, 0]}>
            <cylinderGeometry args={[0.0026, 0.0026, 0.0018, 20]} />
            <MetalMaterial color={LOGIC_COLORS.cellSteel} roughness={0.25} />
          </mesh>
          <mesh position={[0, -CELL.length / 2 + 0.0005, 0]}>
            <cylinderGeometry
              args={[CELL.radius * 0.92, CELL.radius * 0.92, 0.001, 32]}
            />
            <MetalMaterial color={LOGIC_COLORS.cellSteel} roughness={0.25} />
          </mesh>
        </group>
      ))}
      <Post collar="red" x={-reach} />
      <Post collar="black" x={reach} />
    </group>
  );
}

/** The colour bands of a 10 ohm, 5% resistor: brown, black, black, gold. */
const BANDS = [
  { at: -0.0034, color: LOGIC_COLORS.bandBrown },
  { at: -0.0018, color: LOGIC_COLORS.bandBlack },
  { at: -0.0002, color: LOGIC_COLORS.bandBlack },
  { at: 0.0032, color: LOGIC_COLORS.bandGold },
] as const;

/** A 10 ohm carbon film resistor whose tinned leads bend down to the two posts. */
export function Resistor() {
  const { depth, length, reach } = PARTS.resistor;
  const height = BASE_TOP + 0.0075;
  const body = 0.011;
  const lead = reach - body / 2;
  return (
    <group>
      <PartBase depth={depth} length={length} />
      <group position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.0024, body - 0.0048, 6, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={LOGIC_COLORS.resistorBody}
            roughness={0.45}
          />
        </mesh>
        {Arr.map(BANDS, (band) => (
          <mesh key={band.at} position={[0, band.at, 0]}>
            <cylinderGeometry args={[0.0025, 0.0025, 0.0009, 20]} />
            <meshStandardMaterial color={band.color} roughness={0.5} />
          </mesh>
        ))}
      </group>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={side}
          position={[side * (body / 2 + lead / 2), height, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0003, 0.0003, lead, 6]} />
          <MetalMaterial color={LOGIC_COLORS.cellSteel} roughness={0.3} />
        </mesh>
      ))}
      <Post x={-reach} />
      <Post x={reach} />
    </group>
  );
}
