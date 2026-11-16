import { unitOf } from "@/lib/island/noise";
import type { Tone } from "@/lib/island/palette";
import {
  blankTile,
  cellsOf,
  clumps,
  put,
  speckle,
  TILE,
} from "@/lib/island/tiles/paint";
import { markOf } from "@/lib/island/tiles/wang";

/** Soil: warm brown grain with darker clods and a few pebbles. */
export function dirtTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "soil", [
    [1, 0.62],
    [0, 0.2],
    [2, 0.18],
  ]);
  clumps(pixels, seed + 1, 5, "soil", 2, 0);
  clumps(pixels, seed + 2, 2, "stone", 2, 0);
  return pixels;
}

/** The top of grass: blades in tufts, light over dark, on a sunlit green. Every tuft stands inside the tile, so a Wang set lays any two side by side (D39). */
export function grassTopTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "grass", [
    [1, 0.58],
    [2, 0.3],
    [0, 0.12],
  ]);
  for (let index = 0; index < 14; index += 1) {
    const x = Math.floor(unitOf(seed + 3, index, 1) * TILE);
    const y = Math.floor(unitOf(seed + 3, index, 2) * (TILE - 2));
    put(pixels, x, y, "grass", 3);
    put(pixels, x, y + 1, "grass", 2);
    put(pixels, x, y + 2, "grass", 0);
  }
  return pixels;
}

/** The side of grass: soil under a ragged fringe of grass that hangs over the edge. */
export function grassSideTile(seed: number) {
  const pixels = dirtTile(seed + 11);
  for (let x = 0; x < TILE; x += 1) {
    const hang = 2 + Math.floor(unitOf(seed, x, 7) * 3);
    for (let y = 0; y < hang; y += 1) {
      put(pixels, x, y, "grass", y === 0 ? 2 : 1);
    }
    put(pixels, x, hang, "grass", 0);
  }
  return pixels;
}

/** Sand: pale grain with soft ripples catching the light. */
export function sandTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "sand", [
    [1, 0.6],
    [2, 0.25],
    [0, 0.15],
  ]);
  for (let row = 2; row < TILE; row += 5) {
    const start = Math.floor(unitOf(seed, row, 5) * (TILE - 4));
    for (let step = 0; step < 5; step += 1) {
      put(pixels, start + step, row, "sand", 3);
    }
  }
  return pixels;
}

/** Stone: grey slabs split by dark cracks with a highlight on their upper lip. */
export function stoneTile(seed: number) {
  const pixels = blankTile();
  const cells = cellsOf(seed, 5);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const { edge, owner } = cells(x, y);
      const grain = unitOf(seed + 1, x, y) < 0.18 ? 2 : 1;
      put(pixels, x, y, "stone", edge < 1 ? 0 : grain);
      if (edge >= 1 && edge < 2 && owner % 2 === 0) {
        put(pixels, x, y, "stone", 2);
      }
    }
  }
  return pixels;
}

/** Gravel for paths: tight pebbles, each lit on top and shaded below. */
export function gravelTile(seed: number) {
  const pixels = blankTile();
  speckle(pixels, seed, "gravel", [
    [1, 0.5],
    [0, 0.25],
    [2, 0.25],
  ]);
  clumps(pixels, seed + 1, 12, "gravel", 3, 0);
  return pixels;
}

/** Leaves: overlapping clusters with dark gaps between them. */
export function leavesTile(seed: number) {
  const pixels = blankTile();
  const cells = cellsOf(seed, 9);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const { edge, owner } = cells(x, y);
      const lit = unitOf(seed + owner, x, y) < 0.3 ? 3 : 2;
      const body = owner % 3 === 0 ? lit : 1;
      put(pixels, x, y, "leaf", edge < 0.9 ? 0 : body);
    }
  }
  return pixels;
}

/** The bark of a log: furrows that run its whole height. */
export function barkTile(seed: number) {
  const pixels = blankTile();
  for (let x = 0; x < TILE; x += 1) {
    const furrow = unitOf(seed, x) < 0.3;
    for (let y = 0; y < TILE; y += 1) {
      const knot = unitOf(seed + 1, x, y) < 0.06;
      const ridge = x % 4 === 1 ? 2 : 1;
      put(pixels, x, y, "bark", furrow || knot ? 0 : ridge);
    }
  }
  return pixels;
}

/** The cut end of a log: growth rings inside a ring of bark. */
export function ringsTile(seed: number) {
  const pixels = blankTile();
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const ring = Math.hypot(x - 7.5, y - 7.5);
      const wobble = unitOf(seed, x, y) * 0.6;
      const band = Math.floor(ring + wobble) % 3 === 0 ? 1 : 2;
      put(pixels, x, y, ring > 6.6 ? "bark" : "wood", ring > 6.6 ? 0 : band);
    }
  }
  return pixels;
}

/** Water: deep blue in soft bands, with a few short crests; the shader moves it. */
export function waterTile(seed: number) {
  const pixels = blankTile();
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const band = Math.sin((x + y * 0.5) * 0.8 + unitOf(seed, y) * 2) > 0.55;
      put(pixels, x, y, "water", band ? 2 : 1);
    }
  }
  for (let index = 0; index < 4; index += 1) {
    const x = Math.floor(unitOf(seed, index, 1) * TILE);
    const y = Math.floor(unitOf(seed, index, 2) * TILE);
    put(pixels, x, y, "water", 3);
    put(pixels, x + 1, y, "water", 3);
    put(pixels, x + 1, y + 1, "water", 0);
  }
  return pixels;
}

/** Flowers: two stems with leaves and open heads, on a clear tile drawn as a cross. */
export function flowersTile() {
  const pixels = blankTile();
  for (const [stem, top] of [
    [4, 5],
    [11, 3],
  ] as const) {
    for (let y = top + 2; y < TILE; y += 1) {
      put(pixels, stem, y, "leaf", y % 3 === 0 ? 2 : 1);
    }
    put(pixels, stem - 1, top + 7, "leaf", 2);
    put(pixels, stem + 1, top + 9, "leaf", 1);
    const petal = stem < 8 ? "petal" : "bloom";
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      put(pixels, stem + dx, top + 1 + dy, petal, dx < 0 || dy < 0 ? 3 : 1);
    }
    put(pixels, stem, top + 1, petal === "petal" ? "bloom" : "petal", 2);
  }
  return pixels;
}

/** The tone of a blade's pixel `rise` up from its root: the meadow's own tone low down, a tone lighter in its upper half, lightest at its tip. */
function bladeTone(rise: number, tall: number): Tone {
  if (rise === tall - 1) {
    return 3;
  }
  return rise >= tall / 2 ? 3 : 2;
}

/**
 * A tuft of grass (ADR 0047, D44): six to eight blades rising from the
 * tile's foot, each three to seven pixels tall and leaning a pixel or two,
 * in the meadow's own tones, lighter toward the tip, so the season paints
 * them with it. It stands on a grass top as a small cross.
 */
export function tuftTile(seed: number) {
  const pixels = blankTile();
  const blades = 6 + Math.floor(unitOf(seed, 0, 9) * 3);
  for (let blade = 0; blade < blades; blade += 1) {
    const root = 2 + Math.floor(unitOf(seed, blade, 1) * (TILE - 4));
    const tall = 3 + Math.floor(unitOf(seed, blade, 2) * 5);
    const lean = unitOf(seed, blade, 3) < 0.5 ? -1 : 1;
    for (let rise = 0; rise < tall; rise += 1) {
      const x = root + (rise >= tall - 2 ? lean : 0);
      const tone = bladeTone(rise, tall);
      put(pixels, x, TILE - 1 - rise, "grass", tone);
    }
  }
  return pixels;
}

/**
 * The marks of the ground's Wang sets (D39): what straddles an edge where it
 * is marked, a row mark across a north or south edge, a column mark across a
 * west or east edge. Grass and leaf tones only on grass, so the season paints
 * them with the meadow.
 */
export const GRASS_MARKS = [
  // A clump of clover, dark under its lit middle.
  markOf(2, ["..a.a..", ".abcba.", "abcdcba", ".abcba.", "..a.a.."], {
    a: ["leaf", 0],
    b: ["leaf", 1],
    c: ["leaf", 2],
    d: ["grass", 3],
  }),
  // A tuft of tall blades, their tips catching the light.
  markOf(2, ["..d..", ".dc.d", ".cbdc", "dbcbc", "abab.", ".aaa."], {
    a: ["grass", 0],
    b: ["grass", 1],
    c: ["grass", 2],
    d: ["grass", 3],
  }),
] as const;

export const SAND_MARKS = [
  // A ripple the wind left, lit along its crest.
  markOf(1, ["..ddddd..", "ddcccccdd", "bb.....bb"], {
    b: ["sand", 0],
    c: ["sand", 2],
    d: ["sand", 3],
  }),
  // A small shell, its shadow under it.
  markOf(2, [".aa.", "abba", "bccb", ".ss."], {
    a: ["cream", 3],
    b: ["cream", 2],
    c: ["cream", 1],
    s: ["sand", 0],
  }),
] as const;

export const DIRT_MARKS = [
  // A clod, lit on top and shaded under.
  markOf(2, [".aba.", "abcba", ".bdb.", "..d.."], {
    a: ["soil", 3],
    b: ["soil", 2],
    c: ["soil", 1],
    d: ["soil", 0],
  }),
  // Two pebbles.
  markOf(2, ["ab...", "cd.ab", "...cd"], {
    a: ["stone", 3],
    b: ["stone", 2],
    c: ["stone", 1],
    d: ["stone", 0],
  }),
] as const;

export const GRAVEL_MARKS = [
  // Two larger stones bedded in the path.
  markOf(1, [".ab..ab.", "abbcabbc", ".cc..cc."], {
    a: ["gravel", 3],
    b: ["gravel", 2],
    c: ["gravel", 0],
  }),
  // A dip worn by feet.
  markOf(2, [".aa.", "abba", "abba", ".aa."], {
    a: ["gravel", 1],
    b: ["gravel", 0],
  }),
] as const;
