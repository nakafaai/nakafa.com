import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
} from "three";

/** Rings and spokes of an islet's surface mesh. */
const RINGS = 28;
const SPOKES = 72;

/** How far below its crest an islet's skirt ends, well under the waterline. */
const SKIRT = 0.55;

/** The islet's edge at `angle`: a circle the tide has worn unevenly. */
function shore(angle: number, seed: number) {
  return (
    1 +
    0.11 * Math.sin(angle * 3 + seed) +
    0.06 * Math.sin(angle * 5 + seed * 2.3) +
    0.03 * Math.sin(angle * 9 + seed * 4.1)
  );
}

/**
 * Builds a sand islet: a flat crest that rolls off into a beach and on under
 * the water, with low dunes rippling the crest so it is not a table.
 */
function createIslet(radius: number, seed: number) {
  const rings = Arr.range(1, RINGS);
  const spokes = Arr.range(0, SPOKES - 1);
  // Each vertex past the middle one: its place, then its texture coordinate.
  const vertices = Arr.flatMap(rings, (ring) => {
    const reach = ring / RINGS;
    // Flat to two thirds of the way out, then an easing fall to the skirt.
    const fall = Math.max(0, (reach - 0.62) / 0.38);
    const drop = -SKIRT * fall * fall * (3 - 2 * fall);
    return Arr.map(spokes, (spoke) => {
      const angle = (spoke / SPOKES) * Math.PI * 2;
      const span = radius * reach * shore(angle, seed);
      const x = Math.cos(angle) * span;
      const z = Math.sin(angle) * span;
      const dune =
        0.012 * Math.sin(x * 4.1 + seed) * Math.cos(z * 3.3 - seed) * reach;
      return {
        place: [x, drop + dune, z],
        texture: [0.5 + x / (radius * 2.4), 0.5 + z / (radius * 2.4)],
      };
    });
  });
  // A fan of triangles round the middle vertex, then two per cell of each ring.
  const fan = Arr.flatMap(spokes, (spoke) => [
    0,
    1 + ((spoke + 1) % SPOKES),
    1 + spoke,
  ]);
  const bands = Arr.flatMap(Arr.range(1, RINGS - 1), (ring) => {
    const inner = 1 + (ring - 1) * SPOKES;
    const outer = inner + SPOKES;
    return Arr.flatMap(spokes, (spoke) => {
      const next = (spoke + 1) % SPOKES;
      return [
        inner + spoke,
        inner + next,
        outer + spoke,
        inner + next,
        outer + next,
        outer + spoke,
      ];
    });
  });
  const islet = new BufferGeometry();
  islet.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0, 0, ...Arr.flatMap(vertices, (vertex) => vertex.place)],
      3
    )
  );
  islet.setAttribute(
    "uv",
    new Float32BufferAttribute(
      [0.5, 0.5, ...Arr.flatMap(vertices, (vertex) => vertex.texture)],
      2
    )
  );
  islet.setIndex([...fan, ...bands]);
  islet.computeVertexNormals();
  return islet;
}

/** Builds a sea-worn boulder: a ball pushed out of round by slow lumps. */
function createBoulder() {
  const boulder = new IcosahedronGeometry(1, 4);
  const position = boulder.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const lump =
      1 +
      0.16 * Math.sin(x * 2.7 + 1.3) * Math.cos(z * 2.1) +
      0.1 * Math.sin(y * 3.9 + z * 1.7) +
      0.05 * Math.sin(x * 7.3 + y * 5.1);
    position.setXYZ(index, x * lump, y * lump * 0.62, z * lump);
  }
  boulder.computeVertexNormals();
  return boulder;
}

/** Where an islet's boulders lie: [x, z, size, turn], in islet radii. */
const BOULDERS = [
  [-0.6, -0.52, 0.13, 0.4],
  [-0.74, 0.2, 0.08, 1.9],
  [0.34, -0.7, 0.1, 3.1],
  [0.62, 0.5, 0.07, 4.4],
] as const;

/**
 * A low sand islet with a few boulders at its edge, its crest at the origin.
 *
 * @param radius - The islet's mean radius at the waterline
 * @param seed - Shapes this islet's shore, so two islets differ
 */
export function Islet({
  radius,
  seed,
}: {
  readonly radius: number;
  readonly seed: number;
}) {
  const sand = useMemo(() => createIslet(radius, seed), [radius, seed]);
  const boulder = useMemo(createBoulder, []);
  useEffect(() => () => sand.dispose(), [sand]);
  useEffect(() => () => boulder.dispose(), [boulder]);

  return (
    <group>
      <mesh geometry={sand} receiveShadow>
        <SurfaceMaterial
          bump={0.9}
          color={MACHINE_COLORS.sand}
          repeat={[radius * 5, radius * 5]}
          roughness={0.95}
          surface="concrete"
        />
      </mesh>
      {Arr.map(BOULDERS, ([x, z, size, turn]) => (
        <mesh
          castShadow
          geometry={boulder}
          key={turn}
          position={[x * radius, size * radius * 0.2 - 0.06, z * radius]}
          receiveShadow
          rotation={[0, turn + seed, 0]}
          scale={size * radius}
        >
          <SurfaceMaterial
            bump={1.4}
            color={MACHINE_COLORS.basalt}
            repeat={[3, 2]}
            roughness={0.9}
            surface="concrete"
          />
        </mesh>
      ))}
    </group>
  );
}

/** The butt's proportions: a round straw target on a timber easel. */
const BUTT = { face: 0.34, lean: 0.14, thick: 0.09 } as const;

/** The painted rings of the butt's face, from its edge inward: [radius, colour]. */
const RINGS_PAINT = [
  [1, MACHINE_COLORS.deckWhite],
  [0.72, MACHINE_COLORS.signalRed],
  [0.44, MACHINE_COLORS.deckWhite],
  [0.18, MACHINE_COLORS.signalRed],
] as const;

/**
 * A range butt facing -x with its centre at the origin: a thick round face of
 * painted rings, leaned back on a three-legged timber easel that reaches the
 * ground `height` below.
 *
 * @param height - The height of the butt's centre above the ground
 */
export function Butt({ height }: { readonly height: number }) {
  const leg = Math.hypot(height + 0.2, 0.28);
  return (
    <group>
      <group rotation={[0, 0, -BUTT.lean]}>
        <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[BUTT.face, BUTT.face, BUTT.thick, 48]} />
          <SurfaceMaterial
            color={MACHINE_COLORS.hemp}
            repeat={[4, 1]}
            surface="cloth"
          />
        </mesh>
        {Arr.map(RINGS_PAINT, ([share, color], index) => (
          <mesh
            key={share}
            position={[-BUTT.thick / 2 - 0.001 * (index + 1), 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <circleGeometry args={[BUTT.face * share, 48]} />
            <SurfaceMaterial color={color} repeat={[2, 2]} surface="cloth" />
          </mesh>
        ))}
      </group>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[0.1, (0.2 - height) / 2, side * 0.2]}
          rotation={[side * 0.16, 0, -BUTT.lean]}
        >
          <cylinderGeometry args={[0.022, 0.026, leg, 12]} />
          <SurfaceMaterial
            color={MACHINE_COLORS.ash}
            repeat={[1, 3]}
            surface="wood"
          />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0.34, (0.1 - height) / 2, 0]}
        rotation={[0, 0, 0.42]}
      >
        <cylinderGeometry args={[0.022, 0.026, leg * 1.04, 12]} />
        <SurfaceMaterial
          color={MACHINE_COLORS.ash}
          repeat={[1, 3]}
          surface="wood"
        />
      </mesh>
    </group>
  );
}
