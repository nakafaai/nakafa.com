import { Array as Arr } from "effect";
import { ATLAS_TILES } from "@/lib/island/atlas";
import { KIND, LOOK } from "@/lib/island/look";
import {
  blockAt,
  type Cells,
  CHUNK,
  cellOf,
  HEIGHT,
  isInside,
  SPAN,
} from "@/lib/island/world";

/** Floats per vertex: position (3), atlas coordinate (2), face shade, sky light, block light. */
export const STRIDE = 8;

/** How bright each face is under a sky straight above: top, bottom, east and west, south and north. */
const SHADE = { bottom: 0.55, top: 1, x: 0.8, z: 0.68 } as const;

/** How bright a corner is with 0 to 3 open neighbours around it (ambient occlusion). */
const OCCLUSION = [0.5, 0.68, 0.84, 1] as const;

/** A face's normal and its two edges, in the order that winds it counter-clockwise from outside. */
const FACES = [
  { n: [1, 0, 0], shade: SHADE.x, u: [0, 0, -1], v: [0, 1, 0], side: true },
  { n: [-1, 0, 0], shade: SHADE.x, u: [0, 0, 1], v: [0, 1, 0], side: true },
  { n: [0, 0, 1], shade: SHADE.z, u: [1, 0, 0], v: [0, 1, 0], side: true },
  { n: [0, 0, -1], shade: SHADE.z, u: [-1, 0, 0], v: [0, 1, 0], side: true },
  { n: [0, 1, 0], shade: SHADE.top, u: [0, 0, 1], v: [1, 0, 0], side: false },
  {
    n: [0, -1, 0],
    shade: SHADE.bottom,
    u: [1, 0, 0],
    v: [0, 0, 1],
    side: false,
  },
] as const;

/** The corners of a face along its edges: (0, 0), (1, 0), (1, 1), (0, 1). */
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/** A buffer of floats or indices that doubles as it fills. */
function growing<T extends Float32Array | Uint32Array>(
  make: (size: number) => T
) {
  let data = make(4096);
  let size = 0;
  return {
    push(value: number) {
      if (size === data.length) {
        const next = make(data.length * 2);
        next.set(data);
        data = next;
      }
      data[size] = value;
      size += 1;
    },
    count: () => size,
    take: () => data.slice(0, size),
  };
}

/** One draw list: its vertices and the triangles over them. */
function drawList() {
  const vertices = growing((size) => new Float32Array(size));
  const indices = growing((size) => new Uint32Array(size));
  return {
    /** Adds a quad's four corners and its two triangles, split along the brighter diagonal. */
    quad(corners: readonly number[][], flip: boolean) {
      const first = vertices.count() / STRIDE;
      for (const corner of corners) {
        for (const value of corner) {
          vertices.push(value);
        }
      }
      const order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      for (const index of order) {
        indices.push(first + index);
      }
    },
    take: () => ({ indices: indices.take(), vertices: vertices.take() }),
  };
}

/** The highest cell of each column that stops the sky, -1 for an empty column. */
export function skylineOf(cells: Cells) {
  const skyline = new Int8Array(SPAN * SPAN).fill(-1);
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      for (let y = HEIGHT - 1; y >= 0; y -= 1) {
        const kind = LOOK.kinds[cells[cellOf(x, y, z)]];
        if (kind === KIND.solid || kind === KIND.liquid) {
          skyline[z * SPAN + x] = y;
          break;
        }
      }
    }
  }
  return skyline;
}

/** Whether a cell darkens the corners of the faces beside it. */
function occludes(cells: Cells, x: number, y: number, z: number) {
  return LOOK.kinds[blockAt(cells, x, y, z)] === KIND.solid ? 1 : 0;
}

/** Whether a face of `block` toward `neighbour` can be seen. */
function isVisible(block: number, neighbour: number) {
  const kind = LOOK.kinds[neighbour];
  if (kind === KIND.air || kind === KIND.cross) {
    return true;
  }
  return kind !== KIND.solid && neighbour !== block;
}

/** The atlas coordinate of a tile's corner, inset a hair so a pixel of the next tile never shows. */
function uvOf(slot: number, u: number, v: number) {
  const inset = 0.002;
  const cu = u === 0 ? inset : 1 - inset;
  const cv = v === 0 ? inset : 1 - inset;
  return [
    ((slot % ATLAS_TILES) + cu) / ATLAS_TILES,
    (Math.floor(slot / ATLAS_TILES) + cv) / ATLAS_TILES,
  ];
}

/**
 * The light the faces read: the skyline of every column, and the lamp light of
 * every cell from 0 to 15 (none until lanterns spread theirs).
 */
export function lightingOf(cells: Cells, glow = new Uint8Array(cells.length)) {
  return { glow, skyline: skylineOf(cells) };
}

type Lighting = ReturnType<typeof lightingOf>;

/** The sky light of a cell: full in the open, dim under a roof or a tree. */
function skyAt(lighting: Lighting, x: number, y: number, z: number) {
  if (!isInside(x, 0, z)) {
    return 1;
  }
  return y > lighting.skyline[z * SPAN + x] ? 1 : 0.35;
}

/** The lamp light of a cell, from 0 to 1. */
function glowAt(lighting: Lighting, x: number, y: number, z: number) {
  return isInside(x, y, z) ? lighting.glow[cellOf(x, y, z)] / 15 : 0;
}

/** The atlas slot of a face: the block's side tile, or its top or bottom tile. */
function slotOf(block: number, side: boolean, ny: number) {
  if (side) {
    return LOOK.sides[block];
  }
  return ny > 0 ? LOOK.tops[block] : LOOK.bottoms[block];
}

/** One face of a cube: its normal, its edges and its shade, as `FACES` lists them. */
type Face = (typeof FACES)[number];

/**
 * How open one corner of a face is, from 0 to 3: the two cells beside the
 * corner and the one across it, in the layer in front of the face.
 */
function opennessOf(
  cells: Cells,
  face: Face,
  front: readonly [number, number, number],
  su: number,
  sv: number
) {
  const [fx, fy, fz] = front;
  const side1 = occludes(
    cells,
    fx + face.u[0] * su,
    fy + face.u[1] * su,
    fz + face.u[2] * su
  );
  const side2 = occludes(
    cells,
    fx + face.v[0] * sv,
    fy + face.v[1] * sv,
    fz + face.v[2] * sv
  );
  const corner = occludes(
    cells,
    fx + face.u[0] * su + face.v[0] * sv,
    fy + face.u[1] * su + face.v[1] * sv,
    fz + face.u[2] * su + face.v[2] * sv
  );
  return side1 && side2 ? 0 : 3 - side1 - side2 - corner;
}

/** The position of a face's corner (a, b) along its edges, from the corner it starts at. */
function cornerAt(
  cell: readonly [number, number, number],
  face: Face,
  a: number,
  b: number
) {
  const origin = [
    cell[0] + (face.n[0] > 0 ? 1 : 0) + (face.u[0] < 0 ? 1 : 0),
    cell[1] + (face.n[1] > 0 ? 1 : 0),
    cell[2] + (face.n[2] > 0 ? 1 : 0) + (face.u[2] < 0 ? 1 : 0),
  ];
  return [
    origin[0] + face.u[0] * a + face.v[0] * b,
    origin[1] + face.u[1] * a + face.v[1] * b,
    origin[2] + face.u[2] * a + face.v[2] * b,
  ] as const;
}

/** Adds the visible faces of one cube cell. */
function addCube(
  list: ReturnType<typeof drawList>,
  cells: Cells,
  lighting: Lighting,
  cell: readonly [number, number, number],
  block: number
) {
  const [x, y, z] = cell;
  const sunk =
    LOOK.kinds[block] === KIND.liquid && blockAt(cells, x, y + 1, z) !== block;
  for (const face of FACES) {
    const front = [x + face.n[0], y + face.n[1], z + face.n[2]] as const;
    if (!isVisible(block, blockAt(cells, ...front))) {
      continue;
    }
    const slot = slotOf(block, face.side, face.n[1]);
    const sky = skyAt(lighting, ...front);
    const glow = glowAt(lighting, ...front);
    const opens = Arr.map(CORNERS, ([a, b]) =>
      opennessOf(cells, face, front, a === 0 ? -1 : 1, b === 0 ? -1 : 1)
    );
    const corners = Arr.map(CORNERS, ([a, b], index) => {
      const [px, py, pz] = cornerAt(cell, face, a, b);
      const [tu, tv] = face.side
        ? uvOf(slot, a, 1 - b)
        : uvOf(slot, px - x, pz - z);
      const height = sunk && py === y + 1 ? y + 0.875 : py;
      return [
        px,
        height,
        pz,
        tu,
        tv,
        face.shade * OCCLUSION[opens[index]],
        sky,
        glow,
      ];
    });
    list.quad(corners, opens[0] + opens[2] < opens[1] + opens[3]);
  }
}

/** Adds a crossed plant: two planes through the cell, each drawn from both sides. */
function addCross(
  list: ReturnType<typeof drawList>,
  lighting: Lighting,
  cell: readonly [number, number, number],
  block: number
) {
  const [x, y, z] = cell;
  const slot = LOOK.sides[block];
  const sky = skyAt(lighting, x, y, z);
  const glow = glowAt(lighting, x, y, z);
  for (const [ax, az, bx, bz] of [
    [0.15, 0.15, 0.85, 0.85],
    [0.85, 0.15, 0.15, 0.85],
    [0.85, 0.85, 0.15, 0.15],
    [0.15, 0.85, 0.85, 0.15],
  ] as const) {
    const corner = (a: number, b: number) => {
      const [tu, tv] = uvOf(slot, a, 1 - b);
      return [
        x + ax + (bx - ax) * a,
        y + b,
        z + az + (bz - az) * a,
        tu,
        tv,
        0.9,
        sky,
        glow,
      ];
    };
    list.quad([corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)], false);
  }
}

/**
 * The meshes of one chunk (ADR 0047, D3): `solid` holds every opaque, cutout
 * and plant face, drawn first with depth; `water` holds the liquid faces,
 * drawn after with blending.
 */
export function meshChunk(
  cells: Cells,
  lighting: Lighting,
  chunkX: number,
  chunkZ: number
) {
  const solid = drawList();
  const water = drawList();
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let z = chunkZ * CHUNK; z < (chunkZ + 1) * CHUNK; z += 1) {
      for (let x = chunkX * CHUNK; x < (chunkX + 1) * CHUNK; x += 1) {
        const block = cells[cellOf(x, y, z)];
        const kind = LOOK.kinds[block];
        if (kind === KIND.air) {
          continue;
        }
        if (kind === KIND.cross) {
          addCross(solid, lighting, [x, y, z], block);
        } else {
          addCube(
            kind === KIND.liquid ? water : solid,
            cells,
            lighting,
            [x, y, z],
            block
          );
        }
      }
    }
  }
  return { solid: solid.take(), water: water.take() };
}
