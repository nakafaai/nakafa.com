import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import type { Lot } from "@repo/design-system/components/contents/mathematics/network/lots";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { NETWORK_COLORS } from "@repo/design-system/lib/material/network";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/** The model board: its size in metres; its grass top lies at y = 0. */
export const BOARD = { depth: 0.6, width: 0.9 } as const;

/** How wide a model road is, and how high its top stands over the grass. */
export const ROAD = { top: 0.0016, width: 0.013 } as const;

/** How high the paving of a town square stands over the grass. */
const SQUARE_TOP = 0.0022;

/** The planning table's top, under the board. */
const TABLE_TOP = -0.03;

/** The planning table and the model board on it: a painted frame round a flocked grass top. */
export function PlanningTable() {
  return (
    <group>
      <mesh position={[0, TABLE_TOP - 0.02, 0.05]} receiveShadow>
        <boxGeometry args={[1.6, 0.04, 1.05]} />
        <SurfaceMaterial
          bump={0.04}
          color={NETWORK_COLORS.table}
          repeat={[2.4, 12]}
          roughness={0.5}
          surface="wood"
        />
      </mesh>
      <mesh castShadow position={[0, TABLE_TOP / 2 - 0.002, 0]} receiveShadow>
        <boxGeometry args={[BOARD.width, -TABLE_TOP - 0.004, BOARD.depth]} />
        <meshStandardMaterial
          color={NETWORK_COLORS.boardEdge}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0, -0.002, 0]} receiveShadow>
        <boxGeometry args={[BOARD.width - 0.016, 0.004, BOARD.depth - 0.016]} />
        <SurfaceMaterial
          bump={0.3}
          color={NETWORK_COLORS.grass}
          repeat={[6, 4]}
          roughness={0.95}
          surface="concrete"
        />
      </mesh>
    </group>
  );
}

/** A model road from one town's middle to another's, matt asphalt or lit in `lit`. */
export function ModelRoad({
  from,
  lit,
  to,
}: {
  readonly from: Spot;
  readonly lit: string | null;
  readonly to: Spot;
}) {
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  return (
    <mesh
      position={[(from.x + to.x) / 2, ROAD.top / 2, (from.z + to.z) / 2]}
      receiveShadow
      rotation={[0, Math.atan2(-(to.z - from.z), to.x - from.x), 0]}
    >
      <boxGeometry args={[length, ROAD.top, ROAD.width]} />
      <meshStandardMaterial
        color={lit ?? NETWORK_COLORS.road}
        emissive={lit ?? NETWORK_COLORS.road}
        emissiveIntensity={lit === null ? 0 : 0.25}
        roughness={0.85}
      />
    </mesh>
  );
}

/** The small white plate beside a road that carries its length. */
export function LengthPlate({
  at,
  turn,
}: {
  readonly at: Spot;
  readonly turn: number;
}) {
  return (
    <mesh castShadow position={[at.x, 0.0012, at.z]} rotation={[0, turn, 0]}>
      <boxGeometry args={[0.03, 0.0024, 0.016]} />
      <meshStandardMaterial color={NETWORK_COLORS.sign} roughness={0.6} />
    </mesh>
  );
}

/** The paints of a house: its walls, then its roof. */
const WALLS = [NETWORK_COLORS.wall, NETWORK_COLORS.wallWarm] as const;
const ROOFS = [NETWORK_COLORS.roofClay, NETWORK_COLORS.roofSlate] as const;

/**
 * One small rendered house with a gable roof, its ridge along its width. The
 * roof is a three-sided prism of radius one half with a corner pointing up:
 * across, its corner stands 0.5 over its middle and its eaves 0.25 under,
 * and its eaves lie 0.866 apart, before scaling.
 */
function House({ lot }: { readonly lot: Lot }) {
  const rise = (lot.depth * 0.45) / 0.75;
  const span = (lot.depth * 1.14) / 0.866;
  return (
    <group position={[lot.x, SQUARE_TOP, lot.z]} rotation={[0, lot.turn, 0]}>
      <mesh castShadow position={[0, lot.height / 2, 0]} receiveShadow>
        <boxGeometry args={[lot.width, lot.height, lot.depth]} />
        <meshStandardMaterial color={WALLS[lot.wall]} roughness={0.85} />
      </mesh>
      <mesh
        castShadow
        position={[0, lot.height + rise * 0.25, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[rise, 1, span]}
      >
        <cylinderGeometry
          args={[0.5, 0.5, lot.width * 1.08, 3, 1, false, Math.PI / 2]}
        />
        <meshStandardMaterial color={ROOFS[lot.roof]} roughness={0.75} />
      </mesh>
    </group>
  );
}

/** How high a town's sign board stands. */
export const SIGN_TOP = 0.042;

/**
 * A model town: a paved square where its roads meet, its houses round it,
 * and a white sign board on a post. The trip's start and end carry a flag.
 */
export function ModelTown({
  flag,
  lots,
}: {
  readonly flag: "start" | "end" | null;
  readonly lots: readonly Lot[];
}) {
  return (
    <group>
      <mesh position={[0, SQUARE_TOP / 2, 0]} receiveShadow>
        <cylinderGeometry args={[0.022, 0.023, SQUARE_TOP, 32]} />
        <meshStandardMaterial color={NETWORK_COLORS.square} roughness={0.9} />
      </mesh>
      {Arr.map(lots, (lot) => (
        <House key={`${lot.x}-${lot.z}`} lot={lot} />
      ))}
      <mesh castShadow position={[0, SIGN_TOP / 2, 0]}>
        <cylinderGeometry args={[0.0014, 0.0014, SIGN_TOP, 8]} />
        <meshStandardMaterial color={NETWORK_COLORS.post} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, SIGN_TOP - 0.006, 0.0016]}>
        <boxGeometry args={[0.024, 0.012, 0.0014]} />
        <meshStandardMaterial color={NETWORK_COLORS.sign} roughness={0.6} />
      </mesh>
      {flag === null ? null : (
        <mesh castShadow position={[0.0085, SIGN_TOP + 0.008, 0]}>
          <boxGeometry args={[0.016, 0.011, 0.0008]} />
          <meshStandardMaterial
            color={NETWORK_COLORS[flag]}
            roughness={0.7}
            side={DoubleSide}
          />
        </mesh>
      )}
      {flag === null ? null : (
        <mesh castShadow position={[0, SIGN_TOP + 0.007, 0]}>
          <cylinderGeometry args={[0.0008, 0.0008, 0.014, 6]} />
          <meshStandardMaterial color={NETWORK_COLORS.post} roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

/** An orange delivery van with a white roof, facing along x, its wheels on y = 0. */
export function DeliveryVan() {
  return (
    <group>
      <mesh castShadow position={[-0.004, 0.0095, 0]}>
        <boxGeometry args={[0.024, 0.013, 0.0135]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={NETWORK_COLORS.van}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[-0.004, 0.0163, 0]}>
        <boxGeometry args={[0.0236, 0.0005, 0.013]} />
        <meshStandardMaterial color={NETWORK_COLORS.vanRoof} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.0115, 0.0072, 0]}>
        <boxGeometry args={[0.009, 0.0085, 0.0135]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={NETWORK_COLORS.van}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0.0162, 0.0085, 0]}>
        <boxGeometry args={[0.0004, 0.0045, 0.0115]} />
        <meshStandardMaterial
          color={NETWORK_COLORS.vanGlass}
          roughness={0.15}
        />
      </mesh>
      {Arr.map(
        [
          [-0.01, -1],
          [-0.01, 1],
          [0.011, -1],
          [0.011, 1],
        ] as const,
        ([x, side]) => (
          <mesh
            key={`${x}-${side}`}
            position={[x, 0.0028, side * 0.0068]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0028, 0.0028, 0.0022, 16]} />
            <meshStandardMaterial color={NETWORK_COLORS.tyre} roughness={0.9} />
          </mesh>
        )
      )}
    </group>
  );
}
