import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Schema } from "effect";
import { slotUv } from "@/lib/island/atlas";
import { LOOK } from "@/lib/island/look";
import { FACES, STRIDE } from "@/lib/island/mesh";
import { smoothOf, unitOf } from "@/lib/island/noise";
import { SEA_LEVEL } from "@/lib/island/world";

/**
 * The isles around the learner's own (ADR 0047, D23): how many, how far from
 * the middle each one's near shore lies at least, past the whale's round and
 * the learner's footprint, and how much farther it may lie, so the world is
 * never one island alone in the sea.
 */
const RING = { count: 6, from: 58, spread: 30 } as const;

/** One isle of the archipelago: its middle, its radius in cells, its tallest hill in blocks, and whether a wood grows on it. */
const Isle = Schema.Struct({
  forest: Schema.Boolean,
  peak: Schema.Int,
  radius: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
type Isle = typeof Isle.Type;

const SAND = idOf("sand");
const GRASS = idOf("grass");
const STONE = idOf("stone");
const DIRT = idOf("dirt");
const LOG = idOf("log");
const LEAVES = idOf("leaves");

/** How deep the isles' sides reach under the sea, where the water hides the rest. */
const FOOT = SEA_LEVEL - 3;

/** The isles of a seed, spread round the ring, each its own size, height and cover. */
export function islesOf(seed: number) {
  const turn = unitOf(seed + 20, 0, 0, 0) * Math.PI * 2;
  return Arr.makeBy(RING.count, (index): Isle => {
    const roll = (channel: number) => unitOf(seed + 21, index, channel, 0);
    const angle =
      turn + (index * Math.PI * 2) / RING.count + (roll(1) - 0.5) * 0.4;
    const radius = 6 + roll(3) * 9;
    const away = RING.from + radius * 1.15 + roll(2) * RING.spread;
    return {
      forest: roll(5) < 0.5,
      peak: 1 + Math.floor(roll(4) * 5),
      radius,
      x: SPAN / 2 + Math.cos(angle) * away,
      z: SPAN / 2 + Math.sin(angle) * away,
    };
  });
}

/** The block an isle's ground shows: stone on its tallest hills, sand near its edge, grass elsewhere. */
function surfaceOf(top: number, d: number) {
  if (top >= SEA_LEVEL + 4) {
    return STONE;
  }
  return d > 0.72 ? SAND : GRASS;
}

/**
 * The ground of an isle's column (x, z): its top cell and the block on it, none
 * in the sea. A beach rings it, grass covers it, stone tops its tallest hills,
 * and a large isle holds a lake in its middle, under the sea's own level.
 */
export function isleGround(isle: Isle, seed: number, x: number, z: number) {
  const reach = isle.radius * (0.8 + 0.35 * smoothOf(seed + 22, x, z, 4));
  const d = Math.hypot(x + 0.5 - isle.x, z + 0.5 - isle.z) / reach;
  if (d >= 1) {
    return Option.none();
  }
  if (isle.radius >= 11 && d < 0.22) {
    return Option.some({ block: SAND, top: SEA_LEVEL - 2 });
  }
  const rise =
    isle.peak * (1 - d) ** 1.3 * (0.6 + 0.6 * smoothOf(seed + 23, x, z, 5));
  const top = d > 0.85 ? SEA_LEVEL - 1 : SEA_LEVEL + Math.floor(rise);
  return Option.some({ block: surfaceOf(top, d), top });
}

/** The quad of one face of the cube at (x, y, z), in the chunk program's layout, with its block's tile. */
function faceOf(
  block: number,
  face: (typeof FACES)[number],
  x: number,
  y: number,
  z: number
) {
  const slot = face.side ? LOOK.sides[block] : LOOK.tops[block];
  const origin = Arr.map(
    [0, 1, 2] as const,
    (axis) =>
      [x, y, z][axis] +
      Math.max(0, face.n[axis]) +
      Math.max(0, -face.u[axis]) +
      Math.max(0, -face.v[axis])
  );
  return Arr.flatMap(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const,
    ([a, b]) => {
      const [u, v] = slotUv(slot, face.side ? a : b, face.side ? 1 - b : a);
      return [
        origin[0] + face.u[0] * a + face.v[0] * b,
        origin[1] + face.u[1] * a + face.v[1] * b,
        origin[2] + face.u[2] * a + face.v[2] * b,
        u,
        v,
        face.shade,
        1,
        0,
      ];
    }
  );
}

/** The faces of one isle column that show: its top, and each side down to the next column's top or the sea's foot. */
function columnFaces(
  isle: Isle,
  seed: number,
  x: number,
  z: number,
  top: number,
  block: number
) {
  const [upward, ...sides] = [FACES[4], FACES[0], FACES[1], FACES[2], FACES[3]];
  const under = block === STONE ? STONE : DIRT;
  const walls = Arr.flatMap(sides, (face) => {
    const beside = Option.match(
      isleGround(isle, seed, x + face.n[0], z + face.n[2]),
      {
        onNone: () => FOOT - 1,
        onSome: (ground) => ground.top,
      }
    );
    return Arr.flatMap(
      Arr.makeBy(
        Math.max(0, top - Math.max(beside, FOOT - 1)),
        (step) => top - step
      ),
      (y) => faceOf(y === top ? block : under, face, x, y, z)
    );
  });
  return Arr.appendAll(faceOf(block, upward, x, top, z), walls);
}

/** A tree on an isle: a trunk three logs high and a crown of leaves over it, as whole cubes. */
function treeFaces(x: number, top: number, z: number) {
  const trunk = Arr.makeBy(3, (step) => [LOG, x, top + 1 + step, z] as const);
  const crown = Arr.flatMap(
    Arr.makeBy(3, (dz) => dz - 1),
    (dz) =>
      Arr.flatMap(
        Arr.makeBy(3, (dx) => dx - 1),
        (dx) =>
          Arr.makeBy(2, (dy) => [LEAVES, x + dx, top + 4 + dy, z + dz] as const)
      )
  );
  return Arr.flatMap(Arr.appendAll(trunk, crown), ([block, cx, cy, cz]) =>
    Arr.flatMap(FACES, (face) => faceOf(block, face, cx, cy, cz))
  );
}

/**
 * Every isle of a seed as one mesh in the chunk program's layout (ADR 0047,
 * D23): the tops and the shown sides of their columns, and the trees of the
 * wooded ones, drawn by the painter in one call. The sea's own surface covers
 * their beaches' feet and their lakes.
 */
export function islesMesh(seed: number) {
  const vertices = Arr.flatMap(islesOf(seed), (isle) => {
    const span = Math.ceil(isle.radius * 1.2);
    const columns = Arr.flatMap(
      Arr.makeBy(span * 2, (dz) => Math.floor(isle.z) - span + dz),
      (z) =>
        Arr.makeBy(
          span * 2,
          (dx) => [Math.floor(isle.x) - span + dx, z] as const
        )
    );
    return Arr.flatMap(columns, ([x, z]) =>
      Option.match(isleGround(isle, seed, x, z), {
        onNone: () => [],
        onSome: ({ block, top }) =>
          Arr.appendAll(
            columnFaces(isle, seed, x, z, top, block),
            isle.forest && block === GRASS && unitOf(seed + 24, x, 0, z) < 0.05
              ? treeFaces(x, top, z)
              : []
          ),
      })
    );
  });
  const quads = vertices.length / (4 * STRIDE);
  const indices = new Uint32Array(
    Arr.flatMap(
      Arr.makeBy(quads, (quad) => quad),
      (quad) => Arr.map([0, 1, 2, 0, 2, 3], (corner) => corner + quad * 4)
    )
  );
  return { indices, vertices: Float32Array.from(vertices) };
}
