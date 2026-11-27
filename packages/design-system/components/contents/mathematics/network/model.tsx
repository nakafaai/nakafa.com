import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import type { Segment } from "@repo/design-system/components/contents/mathematics/network/relief";
import {
  PEAK,
  reliefAt,
} from "@repo/design-system/components/contents/mathematics/network/relief";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { NETWORK_COLORS } from "@repo/design-system/lib/material/network";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo } from "react";
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
} from "three";

/** The relief map: its size in metres; its valley floor lies at y = 0. */
export const BOARD = { depth: 0.6, width: 0.9 } as const;

/** How thick a road's cord is, and how high its middle lies over the valley floor. */
export const ROAD = { radius: 0.0034, top: 0.0068 } as const;

/** The walnut frame round the map: how wide its rails are and how far they stand over the valley floor. */
const FRAME = { lip: 0.01, rail: 0.022 } as const;

/** The planning table's top, under the map's frame. */
const TABLE_TOP = -0.03;

/** How finely the land is cut, in faces across and back, and painted, in pixels. */
const CUT = { across: 150, back: 100 } as const;
const PAINT = { across: 600, back: 400 } as const;

/** How far apart in height two contour lines lie, in metres, and how much of that a line fills. */
const CONTOUR = { every: PEAK / 7, line: 0.09 } as const;

/**
 * The hypsometric tints of a printed relief map, from the valley floor to
 * the hilltops: each stop's share of the peak and its tint.
 */
const TINTS = [
  [0, NETWORK_COLORS.valley],
  [0.3, NETWORK_COLORS.meadow],
  [0.6, NETWORK_COLORS.upland],
  [1, NETWORK_COLORS.summit],
] as const;

/** The tint of land `share` of the way up to the peak, written into `into`. */
function tintAt(share: number, into: Color) {
  const upper = Math.max(
    1,
    Option.getOrElse(
      Arr.findFirstIndex(TINTS, ([stop]) => stop >= share),
      () => TINTS.length - 1
    )
  );
  const [low, lowTint] = Arr.getUnsafe(TINTS, upper - 1);
  const [high, highTint] = Arr.getUnsafe(TINTS, upper);
  return into
    .set(lowTint)
    .lerp(new Color(highTint), (share - low) / (high - low));
}

/**
 * The relief map the network is pinned to, in a walnut frame on the planning
 * table: moulded land that rises into hills between the roads and lies flat
 * along them, printed with hypsometric tints and a contour line at every
 * step of height, as a raised-relief map is.
 */
export function ReliefMap({
  segments,
  spots,
}: {
  readonly segments: readonly Segment[];
  readonly spots: readonly Spot[];
}) {
  const inner = {
    depth: BOARD.depth - 2 * FRAME.rail,
    width: BOARD.width - 2 * FRAME.rail,
  };
  const land = useMemo(() => {
    const geometry = new PlaneGeometry(
      inner.width,
      inner.depth,
      CUT.across,
      CUT.back
    );
    geometry.rotateX(-Math.PI / 2);
    const places = geometry.getAttribute("position");
    Arr.forEach(Arr.range(0, places.count - 1), (index) => {
      places.setY(
        index,
        reliefAt(
          { x: places.getX(index), z: places.getZ(index) },
          spots,
          segments
        )
      );
    });
    geometry.computeVertexNormals();
    return geometry;
  }, [inner.depth, inner.width, segments, spots]);
  const print = useMemo(() => {
    const data = new Uint8Array(PAINT.across * PAINT.back * 4);
    const tint = new Color();
    const ink = new Color(NETWORK_COLORS.contour);
    Arr.forEach(Arr.range(0, PAINT.back - 1), (row) => {
      Arr.forEach(Arr.range(0, PAINT.across - 1), (column) => {
        const height = reliefAt(
          {
            x: ((column + 0.5) / PAINT.across - 0.5) * inner.width,
            z: (0.5 - (row + 0.5) / PAINT.back) * inner.depth,
          },
          spots,
          segments
        );
        const step = height / CONTOUR.every;
        const onLine = height > 0 && step - Math.floor(step) < CONTOUR.line;
        tintAt(height / PEAK, tint);
        if (onLine) {
          tint.lerp(ink, 0.55);
        }
        tint.convertLinearToSRGB();
        data.set(
          [
            Math.round(tint.r * 255),
            Math.round(tint.g * 255),
            Math.round(tint.b * 255),
            255,
          ],
          (row * PAINT.across + column) * 4
        );
      });
    });
    const texture = new DataTexture(data, PAINT.across, PAINT.back);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [inner.depth, inner.width, segments, spots]);

  useEffect(
    () => () => {
      land.dispose();
      print.dispose();
    },
    [land, print]
  );

  const rails = [
    {
      at: [0, -(BOARD.depth - FRAME.rail) / 2],
      size: [BOARD.width, FRAME.rail],
    },
    {
      at: [0, (BOARD.depth - FRAME.rail) / 2],
      size: [BOARD.width, FRAME.rail],
    },
    {
      at: [-(BOARD.width - FRAME.rail) / 2, 0],
      size: [FRAME.rail, inner.depth],
    },
    {
      at: [(BOARD.width - FRAME.rail) / 2, 0],
      size: [FRAME.rail, inner.depth],
    },
  ] as const;
  const tall = FRAME.lip - TABLE_TOP;

  return (
    <group>
      {Arr.map(rails, (rail) => (
        <mesh
          castShadow
          key={`${rail.at[0]}-${rail.at[1]}`}
          position={[rail.at[0], TABLE_TOP + tall / 2, rail.at[1]]}
          receiveShadow
        >
          <boxGeometry args={[rail.size[0], tall, rail.size[1]]} />
          <SurfaceMaterial
            bump={0.012}
            coat={0.4}
            color={NETWORK_COLORS.frame}
            repeat={[0.4, 3]}
            roughness={0.45}
            surface="wood"
          />
        </mesh>
      ))}
      <mesh castShadow geometry={land} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.25}
          clearcoatRoughness={0.5}
          map={print}
          roughness={0.72}
        />
      </mesh>
    </group>
  );
}

/**
 * A road: a braided cord strung taut from one town's pin to another's, lying
 * along the valley floor. A lit road is a filament that glows in `lit`.
 */
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
      castShadow
      position={[(from.x + to.x) / 2, ROAD.top, (from.z + to.z) / 2]}
      receiveShadow
      rotation={[0, Math.atan2(-(to.z - from.z), to.x - from.x), Math.PI / 2]}
    >
      <cylinderGeometry
        args={[ROAD.radius, ROAD.radius, length, 20, 1, true]}
      />
      {lit === null ? (
        <SurfaceMaterial
          bump={0.5}
          color={NETWORK_COLORS.road}
          repeat={[3, length / 0.012]}
          roughness={0.9}
          surface="cloth"
        />
      ) : (
        <meshStandardMaterial
          color={lit}
          emissive={lit}
          emissiveIntensity={2.6}
          roughness={0.4}
          toneMapped={false}
        />
      )}
    </mesh>
  );
}

/** The small enamel plate beside a road that carries its length. */
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
      <meshPhysicalMaterial
        clearcoat={0.8}
        clearcoatRoughness={0.15}
        color={NETWORK_COLORS.sign}
        roughness={0.4}
      />
    </mesh>
  );
}

/** How high the top of a town's pin stands over the valley floor. */
export const PIN_TOP = 0.056;

/** A pin's turned parts: its head, its shaft and the grommet it is pressed through. */
const PIN = { grommet: 0.019, head: 0.0115, shaft: 0.0016 } as const;

/** The grommet's profile, turned on a lathe: a rolled rim round a dished washer. */
const GROMMET = Arr.map(
  [
    [0.0001, 0.0026],
    [PIN.grommet * 0.5, 0.0026],
    [PIN.grommet * 0.62, 0.0018],
    [PIN.grommet * 0.8, 0.0018],
    [PIN.grommet * 0.9, 0.003],
    [PIN.grommet, 0.0024],
    [PIN.grommet, 0.0004],
    [PIN.grommet * 0.96, 0],
    [0.0001, 0],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/**
 * A town: a polished brass map pin pressed through a brass grommet where its
 * roads meet. The pin's round head is bare brass, or enamelled green at the
 * trip's start and red at its end.
 */
export function ModelTown({ flag }: { readonly flag: "start" | "end" | null }) {
  const head = PIN_TOP - PIN.head;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[GROMMET, 48]} />
        <MetalMaterial color={NETWORK_COLORS.brass} roughness={0.24} />
      </mesh>
      <mesh castShadow position={[0, head / 2, 0]}>
        <cylinderGeometry args={[PIN.shaft, PIN.shaft, head, 16]} />
        <MetalMaterial color={NETWORK_COLORS.steel} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0, head, 0]}>
        <sphereGeometry args={[PIN.head, 40, 28]} />
        {flag === null ? (
          <MetalMaterial color={NETWORK_COLORS.brass} roughness={0.14} />
        ) : (
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.05}
            color={NETWORK_COLORS[flag]}
            roughness={0.2}
          />
        )}
      </mesh>
    </group>
  );
}

/**
 * The runner that travels a route: a glass bead threaded on the cord, lit
 * from inside in the route's colour, its middle on y = 0.
 */
export function RouteBead() {
  return (
    <mesh castShadow>
      <sphereGeometry args={[0.0085, 36, 24]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.04}
        color={NETWORK_COLORS.bead}
        emissive={NETWORK_COLORS.bead}
        emissiveIntensity={1.8}
        roughness={0.12}
        toneMapped={false}
      />
    </mesh>
  );
}
