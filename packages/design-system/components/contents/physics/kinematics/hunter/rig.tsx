import { RoundedBox } from "@react-three/drei";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { TARGET_COLORS } from "@repo/design-system/lib/material/target";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/** The catering tin the launcher is aimed at, in metres: 0.16 m across and 0.24 m tall. */
export const TIN = { height: 0.24, radius: 0.08 } as const;

/** How wide the launcher's bore is, in metres: the ball it fires fills it. */
export const BORE = 0.075;

/** How long the barrel is, and how far behind its muzzle it turns in its yoke, in metres. */
const BARREL_LONG = 0.68;
const PIVOT = 0.46;

/** The barrel's outline: up its outside from the breech to the muzzle, then down its bore. */
const BARREL = [
  [0, 0],
  [0.094, 0],
  [0.104, 0.012],
  [0.104, 0.09],
  [0.09, 0.1],
  [0.09, 0.61],
  [0.1, 0.62],
  [0.1, 0.672],
  [0.094, BARREL_LONG],
  [BORE + 0.004, BARREL_LONG],
  [BORE + 0.003, 0.1],
  [0, 0.1],
] as const;

/** The brass ring shrunk onto the muzzle. */
const MUZZLE_RING = [
  [0.1005, 0.625],
  [0.1035, 0.629],
  [0.1035, 0.663],
  [0.1005, 0.667],
] as const;

/** The knurled collar the launcher is cocked by. */
const COLLAR = [
  [0.0905, 0.385],
  [0.101, 0.39],
  [0.101, 0.455],
  [0.0905, 0.46],
] as const;

/** The trunnion the barrel turns on, lying along its own axis. */
const TRUNNION = [
  [0, -0.146],
  [0.019, -0.146],
  [0.022, -0.143],
  [0.022, 0.143],
  [0.019, 0.146],
  [0, 0.146],
] as const;

/** The launcher's foot, cast heavy so the recoil does not walk it. */
const FOOT = [
  [0, 0],
  [0.25, 0],
  [0.26, 0.01],
  [0.26, 0.022],
  [0.2, 0.05],
  [0.07, 0.06],
  [0.045, 0.1],
  [0, 0.1],
] as const;

/** The tin's outline from its base to its lid, with the beads rolled into its wall. */
const TIN_WALL = [
  [0, 0.004],
  [0.074, 0.004],
  [TIN.radius, 0],
  [TIN.radius, 0.012],
  [0.077, 0.018],
  [0.077, 0.066],
  [0.0785, 0.072],
  [0.077, 0.078],
  [0.077, 0.162],
  [0.0785, 0.168],
  [0.077, 0.174],
  [0.077, 0.222],
  [TIN.radius, 0.228],
  [TIN.radius, TIN.height],
  [0.074, TIN.height - 0.004],
  [0, TIN.height - 0.006],
] as const;

/** The tin's paper label, wrapped between its beads. */
const TIN_LABEL = [
  [0.0778, 0.082],
  [0.0778, 0.158],
] as const;

/** The electromagnet's iron core and its two cheeks, from the pole up. */
const CORE = [
  [0, 0],
  [0.07, 0],
  [0.072, 0.002],
  [0.072, 0.012],
  [0.05, 0.014],
  [0.05, 0.12],
  [0.072, 0.122],
  [0.072, 0.132],
  [0.07, 0.134],
  [0.02, 0.134],
  [0.018, 0.19],
  [0, 0.19],
] as const;

/** The copper wound on the core, turn against turn. */
const WINDING = {
  from: [0, 0.019, 0],
  kind: "helix",
  radius: 0.056,
  to: [0, 0.115, 0],
  turns: 12,
} as const;

/** The magnet's lead: from the coil along the arm and down the column. */
const LEAD = [
  [0.06, 0.07, 0.03],
  [0.16, 0.16, 0.045],
  [0.44, 0.215, 0.03],
  [0.84, 0.215, 0.034],
  [0.955, 0.1, 0.045],
  [0.955, -0.7, 0.04],
] as const;

/** The arm that carries the magnet out over the range, from the magnet to the column's clamp. */
const ARM = [
  [-0.09, 0.185, 0],
  [0.97, 0.185, 0],
] as const;

/**
 * A catering tin with its rolled rims, the beads pressed into its wall and a
 * paper label, standing on its base at the origin.
 */
export function Tin() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <Turn profile={TIN_WALL} />
        <SurfaceMaterial
          color={TARGET_COLORS.tin}
          metalness={0.9}
          repeat={[3, 1]}
          roughness={0.28}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow>
        <Turn profile={TIN_LABEL} />
        <SurfaceMaterial
          color={TARGET_COLORS.tinLabel}
          repeat={[2, 1]}
          roughness={0.75}
          side={DoubleSide}
          surface="tissue"
        />
      </mesh>
    </group>
  );
}

/**
 * A spring launcher on its floor stand: a blued steel barrel with a brass
 * muzzle ring and a knurled cocking collar, turning in a yoke at the angle
 * it is aimed, on a column with a heavy foot. Its muzzle is at the origin
 * and it fires along +x, raised by `aim` radians.
 *
 * @param aim - How far the barrel is raised from level, in radians
 * @param drop - How far below the muzzle the floor is, in metres
 */
export function Launcher({
  aim,
  drop,
}: {
  readonly aim: number;
  readonly drop: number;
}) {
  const pivot = [-PIVOT * Math.cos(aim), -PIVOT * Math.sin(aim)] as const;
  const yoke = pivot[1] - 0.24;
  const column = [
    [pivot[0], -drop + 0.09, 0],
    [pivot[0], yoke, 0],
  ] as const;

  return (
    <group>
      <group
        position={[
          -BARREL_LONG * Math.cos(aim),
          -BARREL_LONG * Math.sin(aim),
          0,
        ]}
        rotation={[0, 0, aim - Math.PI / 2]}
      >
        <mesh castShadow>
          <Turn profile={BARREL} />
          <SurfaceMaterial
            coat={0.5}
            color={TARGET_COLORS.barrel}
            metalness={0.8}
            repeat={[3, 4]}
            roughness={0.34}
            side={DoubleSide}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow>
          <Turn profile={MUZZLE_RING} />
          <SurfaceMaterial
            color={TARGET_COLORS.brass}
            metalness={0.95}
            repeat={[3, 1]}
            roughness={0.25}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow>
          <Turn profile={COLLAR} />
          <SurfaceMaterial
            color={TARGET_COLORS.steel}
            metalness={0.9}
            repeat={[8, 1]}
            roughness={0.4}
            surface="knurl"
          />
        </mesh>
      </group>
      {Arr.map([1, -1] as const, (side) => (
        <RoundedBox
          args={[0.11, 0.34, 0.02]}
          castShadow
          key={side}
          position={[pivot[0], pivot[1] - 0.07, side * 0.118]}
          radius={0.008}
          smoothness={3}
        >
          <SurfaceMaterial
            color={TARGET_COLORS.base}
            metalness={0.7}
            repeat={[2, 3]}
            roughness={0.5}
            surface="cast"
          />
        </RoundedBox>
      ))}
      <mesh
        castShadow
        position={[pivot[0], pivot[1], 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <Turn profile={TRUNNION} />
        <SurfaceMaterial
          color={TARGET_COLORS.steel}
          metalness={0.9}
          repeat={[1, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <RoundedBox
        args={[0.13, 0.03, 0.256]}
        castShadow
        position={[pivot[0], yoke + 0.015, 0]}
        radius={0.008}
        smoothness={3}
      >
        <SurfaceMaterial
          color={TARGET_COLORS.base}
          metalness={0.7}
          repeat={[2, 2]}
          roughness={0.5}
          surface="cast"
        />
      </RoundedBox>
      <mesh castShadow>
        <Sweep path={column} radius={0.03} />
        <SurfaceMaterial
          color={TARGET_COLORS.steel}
          metalness={0.9}
          repeat={[6, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[pivot[0], -drop, 0]} receiveShadow>
        <Turn profile={FOOT} />
        <SurfaceMaterial
          color={TARGET_COLORS.base}
          metalness={0.7}
          repeat={[4, 1]}
          roughness={0.55}
          surface="cast"
        />
      </mesh>
    </group>
  );
}

/**
 * The stand that holds the tin and lets it go: a heavy foot on the bench, a
 * steel column, an arm that reaches out over the range, and an electromagnet
 * wound with copper whose pole holds the tin's lid until the launcher fires.
 * The magnet's pole is at the origin, facing down, and the column stands
 * further along +x.
 *
 * @param drop - How far below the pole the bench top is, in metres
 */
export function MagnetStand({ drop }: { readonly drop: number }) {
  const column = [
    [0.92, -drop + 0.05, 0],
    [0.92, 0.3, 0],
  ] as const;

  return (
    <group>
      <mesh castShadow>
        <Turn profile={CORE} />
        <SurfaceMaterial
          color={TARGET_COLORS.steel}
          metalness={0.9}
          repeat={[2, 1]}
          roughness={0.35}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow>
        <Sweep ends="round" path={WINDING} radius={0.0045} />
        <SurfaceMaterial
          coat={0.6}
          color={TARGET_COLORS.coil}
          metalness={0.85}
          repeat={[60, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow>
        <Sweep ends="round" path={ARM} radius={0.022} />
        <SurfaceMaterial
          color={TARGET_COLORS.steel}
          metalness={0.9}
          repeat={[5, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <RoundedBox
        args={[0.1, 0.1, 0.1]}
        castShadow
        position={[0.92, 0.185, 0]}
        radius={0.014}
        smoothness={3}
      >
        <SurfaceMaterial
          color={TARGET_COLORS.base}
          metalness={0.7}
          repeat={[1, 1]}
          roughness={0.5}
          surface="cast"
        />
      </RoundedBox>
      <mesh castShadow>
        <Sweep ends={["flat", "round"]} path={column} radius={0.028} />
        <SurfaceMaterial
          color={TARGET_COLORS.steel}
          metalness={0.9}
          repeat={[12, 1]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <RoundedBox
        args={[0.6, 0.06, 0.5]}
        castShadow
        position={[0.92, -drop + 0.03, 0]}
        radius={0.016}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={TARGET_COLORS.base}
          metalness={0.7}
          repeat={[3, 2]}
          roughness={0.55}
          surface="cast"
        />
      </RoundedBox>
      <mesh castShadow>
        <Sweep ends="round" path={LEAD} radius={0.008} />
        <SurfaceMaterial
          color={TARGET_COLORS.barrel}
          repeat={[40, 1]}
          surface="rubber"
        />
      </mesh>
    </group>
  );
}

/** How long, deep, thick and tall one bench table is, in metres. */
const TABLE = { deep: 0.9, high: 0.9, long: 1.8, top: 0.045 } as const;

/** How tall the bench stands over the floor, in metres. */
export const BENCH_HIGH = TABLE.high;

/** Where a table's four legs stand, as shares of its half length and half depth. */
const LEGS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * A row of laboratory tables pushed end to end into one long bench: beech
 * tops on welded steel frames. The bench top is at the origin's height and
 * the row runs along +x from the origin.
 *
 * @param tables - How many tables stand in the row
 */
export function Bench({ tables }: { readonly tables: number }) {
  return (
    <group>
      {Arr.map(Arr.range(0, tables - 1), (table) => (
        <group
          key={table}
          position={[(table + 0.5) * (TABLE.long + 0.004), 0, 0]}
        >
          <RoundedBox
            args={[TABLE.long, TABLE.top, TABLE.deep]}
            castShadow
            position={[0, -TABLE.top / 2, 0]}
            radius={0.008}
            receiveShadow
            smoothness={3}
          >
            <SurfaceMaterial
              coat={0.35}
              color={TARGET_COLORS.benchTop}
              repeat={[3, 1.5]}
              roughness={0.5}
              surface="wood"
            />
          </RoundedBox>
          {Arr.map([1, -1] as const, (side) => (
            <RoundedBox
              args={[TABLE.long - 0.16, 0.07, 0.03]}
              castShadow
              key={side}
              position={[
                0,
                -TABLE.top - 0.035,
                side * (TABLE.deep / 2 - 0.075),
              ]}
              radius={0.006}
              smoothness={2}
            >
              <SurfaceMaterial
                color={TARGET_COLORS.benchFrame}
                metalness={0.6}
                repeat={[6, 1]}
                roughness={0.5}
                surface="paint"
              />
            </RoundedBox>
          ))}
          {Arr.map(LEGS, ([along, across]) => (
            <RoundedBox
              args={[0.045, TABLE.high - TABLE.top, 0.045]}
              castShadow
              key={`${along}:${across}`}
              position={[
                along * (TABLE.long / 2 - 0.08),
                -TABLE.top - (TABLE.high - TABLE.top) / 2,
                across * (TABLE.deep / 2 - 0.075),
              ]}
              radius={0.008}
              smoothness={2}
            >
              <SurfaceMaterial
                color={TARGET_COLORS.benchFrame}
                metalness={0.6}
                repeat={[1, 8]}
                roughness={0.5}
                surface="paint"
              />
            </RoundedBox>
          ))}
        </group>
      ))}
    </group>
  );
}
