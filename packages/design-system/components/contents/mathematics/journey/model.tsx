import {
  landAt,
  PEAK,
} from "@repo/design-system/components/contents/mathematics/journey/land";
import {
  BOARD,
  HALF,
  LAND,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { StudioTable } from "@repo/design-system/components/contents/mathematics/table";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";

/** How high the road's strip of land lies over y = 0, and the asphalt's top, which the vehicles drive on. */
export const BASE = 0.006;
export const ROAD_TOP = 0.0078;

/** The planning table's top, under the diorama's frame. */
const TABLE_TOP = -0.03;

/** The walnut frame round the land: how wide its rails are, and how far they stand over the road's strip. */
const FRAME = { lip: 0.0012, rail: 0.016 } as const;

/** How finely the land is cut, in faces along and across, and painted, in pixels. */
const CUT = { across: 96, along: 180 } as const;
const PAINT = { across: 384, along: 768 } as const;

/** How long a dash of the centre line is, and from one dash to the next. */
const DASH = { length: 0.012, spacing: 0.026 } as const;

/** How far the left and right verges' things stand from the road's middle. */
export const VERGE = BOARD.asphalt / 2 + (BOARD.width - BOARD.asphalt) / 4;

/**
 * The moulded land of the diorama, flocked like a model railway's: green
 * along the verges, paler where the noise thins the flock, and darker on the
 * hills behind the road.
 */
function Land() {
  const width = LAND.back + LAND.front;
  const middle = (LAND.front - LAND.back) / 2;
  const land = useMemo(() => {
    const geometry = new PlaneGeometry(width, 2 * HALF, CUT.across, CUT.along);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(middle, 0, 0);
    const places = geometry.getAttribute("position");
    Arr.forEach(Arr.range(0, places.count - 1), (index) => {
      places.setY(index, landAt(places.getX(index), places.getZ(index)));
    });
    geometry.computeVertexNormals();
    return geometry;
  }, [middle, width]);
  const flock = useMemo(() => {
    const data = new Uint8Array(PAINT.across * PAINT.along * 4);
    const tint = new Color();
    const meadow = new Color(JOURNEY_COLORS.meadow);
    const hill = new Color(JOURNEY_COLORS.hill);
    Arr.forEach(Arr.range(0, PAINT.along - 1), (row) => {
      Arr.forEach(Arr.range(0, PAINT.across - 1), (column) => {
        const x = -LAND.back + ((column + 0.5) / PAINT.across) * width;
        const z = HALF - ((row + 0.5) / PAINT.along) * 2 * HALF;
        const patch = valueNoise((x + 3) * 23, (z + 3) * 23, 64);
        const speck = hashUnit(column, row);
        tint
          .set(JOURNEY_COLORS.grass)
          .lerp(meadow, 0.7 * patch * patch)
          .lerp(hill, Math.min(1, (landAt(x, z) / PEAK.back) * 1.5))
          .multiplyScalar(0.86 + 0.28 * speck)
          .convertLinearToSRGB();
        data.set(
          [
            Math.round(Math.min(1, tint.r) * 255),
            Math.round(Math.min(1, tint.g) * 255),
            Math.round(Math.min(1, tint.b) * 255),
            255,
          ],
          (row * PAINT.across + column) * 4
        );
      });
    });
    const texture = new DataTexture(data, PAINT.across, PAINT.along);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [width]);

  useEffect(
    () => () => {
      land.dispose();
      flock.dispose();
    },
    [flock, land]
  );

  return (
    <mesh castShadow geometry={land} position={[0, BASE, 0]} receiveShadow>
      <meshStandardMaterial
        bumpMap={flock}
        bumpScale={0.6}
        map={flock}
        roughness={0.96}
      />
    </mesh>
  );
}

/** The walnut frame round the land, standing on the planning table. */
function Frame() {
  const width = LAND.back + LAND.front + 2 * FRAME.rail;
  const middle = (LAND.front - LAND.back) / 2;
  const tall = BASE + FRAME.lip - TABLE_TOP;
  const rails = [
    { at: [middle, HALF + FRAME.rail / 2], size: [width, FRAME.rail] },
    { at: [middle, -HALF - FRAME.rail / 2], size: [width, FRAME.rail] },
    { at: [-LAND.back - FRAME.rail / 2, 0], size: [FRAME.rail, 2 * HALF] },
    { at: [LAND.front + FRAME.rail / 2, 0], size: [FRAME.rail, 2 * HALF] },
  ] as const;
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
            color={JOURNEY_COLORS.frame}
            repeat={[0.4, 3]}
            roughness={0.45}
            surface="wood"
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The model road, its middle at x = 0, from one end of the diorama to the
 * other: matt asphalt with white edge lines and a dashed centre line, a
 * white line across it at `start`, and a white post with a dark cap on the
 * right verge at every kilometre mark of `marks`.
 */
export function Roadway({
  marks,
  start,
}: {
  readonly marks: readonly number[];
  readonly start: number;
}) {
  const length = 2 * HALF;
  const dashes = Math.floor(length / DASH.spacing);
  return (
    <group>
      <mesh position={[0, (BASE + ROAD_TOP) / 2, 0]} receiveShadow>
        <boxGeometry args={[BOARD.asphalt, ROAD_TOP - BASE, length]} />
        <SurfaceMaterial
          bump={0.05}
          color={JOURNEY_COLORS.asphalt}
          repeat={[1, length * 12]}
          roughness={0.9}
          surface="concrete"
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={side}
          position={[side * (BOARD.asphalt / 2 - 0.003), ROAD_TOP + 0.0001, 0]}
          receiveShadow
        >
          <boxGeometry args={[0.0016, 0.0002, length]} />
          <meshStandardMaterial color={JOURNEY_COLORS.paint} roughness={0.7} />
        </mesh>
      ))}
      {Arr.makeBy(dashes, (index) => (
        <mesh
          key={index}
          position={[
            0,
            ROAD_TOP + 0.0001,
            -HALF + (index + 0.5) * DASH.spacing,
          ]}
          receiveShadow
        >
          <boxGeometry args={[0.0013, 0.0002, DASH.length]} />
          <meshStandardMaterial color={JOURNEY_COLORS.paint} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, ROAD_TOP + 0.000_15, start]} receiveShadow>
        <boxGeometry args={[BOARD.asphalt - 0.004, 0.0002, 0.0035]} />
        <meshStandardMaterial color={JOURNEY_COLORS.paint} roughness={0.7} />
      </mesh>
      {Arr.map(marks, (z) => (
        <group key={z} position={[VERGE, BASE, z]}>
          <mesh castShadow position={[0, 0.006, 0]}>
            <cylinderGeometry args={[0.0017, 0.002, 0.012, 20]} />
            <meshStandardMaterial color={JOURNEY_COLORS.post} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 0.0127, 0]}>
            <cylinderGeometry args={[0.0017, 0.0017, 0.0014, 20]} />
            <meshStandardMaterial color={JOURNEY_COLORS.tyre} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A bus stop on the left verge, facing the road: a glazed shelter with a
 * blue roof on two poles over a bench, and a pole with a blue sign beside it.
 */
function BusStop({ z }: { readonly z: number }) {
  return (
    <group position={[-VERGE, BASE, z]}>
      <mesh castShadow position={[-0.007, 0.009, 0]}>
        <boxGeometry args={[0.0012, 0.016, 0.03]} />
        <meshPhysicalMaterial
          color={JOURNEY_COLORS.shelter}
          opacity={0.55}
          roughness={0.08}
          transparent
        />
      </mesh>
      <mesh castShadow position={[-0.001, 0.0178, 0]}>
        <boxGeometry args={[0.017, 0.0014, 0.034]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={JOURNEY_COLORS.roof}
          roughness={0.4}
        />
      </mesh>
      <mesh castShadow position={[-0.004, 0.0042, 0]}>
        <boxGeometry args={[0.0046, 0.0009, 0.022]} />
        <meshStandardMaterial color={JOURNEY_COLORS.trunk} roughness={0.7} />
      </mesh>
      {Arr.map([-0.015, 0.015] as const, (along) => (
        <mesh castShadow key={along} position={[0.006, 0.0085, along]}>
          <cylinderGeometry args={[0.0007, 0.0007, 0.017, 16]} />
          <meshStandardMaterial
            color={JOURNEY_COLORS.pole}
            metalness={0.8}
            roughness={0.35}
          />
        </mesh>
      ))}
      <mesh castShadow position={[0.008, 0.012, -0.022]}>
        <cylinderGeometry args={[0.0006, 0.0006, 0.024, 16]} />
        <meshStandardMaterial
          color={JOURNEY_COLORS.pole}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <mesh
        castShadow
        position={[0.008, 0.0225, -0.022]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0042, 0.0042, 0.0009, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={JOURNEY_COLORS.sign}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

/** The clumps of a tree's crown: where each sits over the trunk and how large it is. */
const CLUMPS = [
  [0, 0.02, 0, 0.0105],
  [0.0055, 0.0165, 0.003, 0.0075],
  [-0.005, 0.017, -0.0035, 0.008],
  [0.001, 0.027, -0.001, 0.0068],
] as const;

/**
 * A model tree on the left verge: a tapered trunk under a crown of four
 * clumps of foliage, turned by `turn` so no two trees stand alike.
 */
function Tree({ turn, z }: { readonly turn: number; readonly z: number }) {
  return (
    <group position={[-VERGE, BASE, z]} rotation={[0, turn * Math.PI * 2, 0]}>
      <mesh castShadow position={[0, 0.007, 0]}>
        <cylinderGeometry args={[0.0013, 0.0022, 0.014, 12]} />
        <meshStandardMaterial color={JOURNEY_COLORS.trunk} roughness={0.9} />
      </mesh>
      {Arr.map(CLUMPS, ([x, y, along, radius], index) => (
        <mesh castShadow key={radius} position={[x, y, along]}>
          <icosahedronGeometry args={[radius, 3]} />
          <SurfaceMaterial
            bump={0.5}
            color={
              index % 2 === 0 ? JOURNEY_COLORS.leaves : JOURNEY_COLORS.leavesLit
            }
            repeat={[3, 3]}
            roughness={0.95}
            surface="bark"
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The road diorama on its table, in the road's own frame: flocked land in a
 * walnut frame, a shelter on the left verge at every stop of `stops`, and
 * trees along the verge between them. The road itself is its `children`.
 */
export function Diorama({
  children,
  stops,
  trees,
}: {
  readonly children: ReactNode;
  readonly stops: readonly number[];
  readonly trees: readonly number[];
}) {
  return (
    <group>
      <group position={[0, TABLE_TOP, 0]}>
        <StudioTable color={JOURNEY_COLORS.table} />
      </group>
      <Frame />
      <Land />
      {children}
      {Arr.map(stops, (z) => (
        <BusStop key={z} z={z} />
      ))}
      {Arr.map(trees, (z, index) => (
        <Tree key={z} turn={hashUnit(index, 11)} z={z} />
      ))}
    </group>
  );
}
