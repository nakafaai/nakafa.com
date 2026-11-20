import { smoothOf } from "@/lib/island/noise";

/** The sea's face, in blocks above the world's floor (ADR 0047, D3; ADR 0050, W1). */
export const SEA = 8;

/** How high one terrace stands over the one below it, in blocks. */
const TERRACE = 6;

/** The share of a terrace's rise at which its cliff starts: late enough to stand as a wall, early enough that the wall is a couple of blocks thick and its line runs smooth across the lattice. */
const RISER = 0.8;

/** The elevation over the sea from which land holds rivers and lakes; lower ground is beach. */
const SHORE = 0.3;

/** The wetness of ground no river or lake reaches. */
const DRY = -9;

/** Half the width of a river along the zero line of its field. */
const RIVER = 0.03;

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function blend(from: number, to: number, share: number) {
  return from + (to - from) * share;
}

/** The smooth step from 0 at `from` to 1 at `to`, which may lie below `from`. */
export function ease(from: number, to: number, value: number) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

/** Value noise summed over octaves, each about twice as fine and half as strong as the one before, in [0, 1). */
function layered(
  seed: number,
  x: number,
  z: number,
  scale: number,
  octaves: number
) {
  let sum = 0;
  let weight = 0;
  let strength = 0.5;
  let size = scale;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum +=
      strength *
      smoothOf(seed + octave * 101, x + octave * 517, z - octave * 293, size);
    weight += strength;
    strength /= 2;
    size /= 2.03;
  }
  return sum / weight;
}

/**
 * The field whose zero line the rivers run along (ADR 0050, W1): slow noise
 * read at a place pushed about by a second noise, so a river winds instead of
 * following the noise's own grid.
 */
export function riverOf(seed: number, x: number, z: number) {
  const warpedX = x + (smoothOf(seed + 21, x, z, 60) - 0.5) * 44;
  const warpedZ = z + (smoothOf(seed + 22, x + 540, z + 240, 60) - 0.5) * 44;
  return layered(seed + 31, warpedX, warpedZ, 190, 2) - 0.5;
}

/**
 * How high the continent stands over the sea at a place before it is cut into
 * terraces, in blocks, below zero under the sea. A rise about the origin keeps
 * land near where every world opens.
 */
export function elevationOf(seed: number, x: number, z: number) {
  return (
    (layered(seed, x, z, 310, 3) - 0.47) * 120 +
    17 * Math.exp(-(x * x + z * z) / 30_000)
  );
}

/**
 * The terraces under a place: whole steps a terrace high, each with a cliff at
 * its edge, eased into a slope a walker can climb wherever a slow noise runs
 * high, so no plateau is cut off from the one below.
 */
function terraceOf(seed: number, x: number, z: number, elevation: number) {
  if (elevation <= 0) {
    return 0;
  }
  const steps = elevation / TERRACE;
  const whole = Math.floor(steps);
  const ramp = ease(0.6, 0.76, smoothOf(seed + 77, x, z, 64));
  return (whole + ease(blend(RISER, 0.1, ramp), 1, steps - whole)) * TERRACE;
}

/**
 * How wet a place on land is: above zero inside a river or a lake, falling
 * below it with the distance from their banks.
 */
function wetOf(seed: number, x: number, z: number) {
  const river = Math.abs(riverOf(seed, x, z)) * 2;
  const lake = layered(seed + 41, x, z, 85, 2);
  return Math.max(1 - river / RIVER, (lake - 0.665) / 0.035);
}

/**
 * The ground beside and under inland water whose face stands at `face`: no
 * dip below the water next to a bank, a bank that comes down to it, and a bed
 * that deepens toward the middle.
 */
function bankOf(ground: number, face: number, wet: number) {
  const raised = blend(
    ground,
    Math.max(ground, face + 0.08 + 0.3 * ease(0, -1.2, wet)),
    ease(-3.4, -2.5, wet)
  );
  const lowered = blend(
    raised,
    Math.min(raised, face + 0.4),
    ease(-2.4, -0.1, wet)
  );
  return blend(
    lowered,
    face - 0.12 - 1.25 * ease(0, 1, wet),
    ease(-0.3, 0.2, wet)
  );
}

/**
 * The land at one lattice point (ADR 0050, W1), the same for a seed and a
 * place on every device: the ground's height and the height of the water's
 * face over it, both in blocks above the world's floor, with no water where
 * the face lies under the ground; the continent's elevation; how wet the place
 * is; and how much of it is beach, meadow and forest, each from 0 to 1.
 */
export function pointOf(seed: number, x: number, z: number) {
  const elevation = elevationOf(seed, x, z);
  const land = ease(0, 4, elevation);
  const level = land * 1.3 + terraceOf(seed, x, z, elevation);
  const reach = 0.45 + clamp(elevation / 45, 0, 1) * 4.2;
  const hills = (layered(seed + 7, x, z, 46, 3) - 0.5) * 2 * reach * land;
  const detail = (smoothOf(seed + 13, x, z, 7) - 0.5) * 0.3;
  const open =
    elevation > 0 ? level + hills + detail : elevation * 0.5 + detail * 0.4;
  const inland = elevation > SHORE;
  const wet = inland ? wetOf(seed, x, z) : DRY;
  const face = level - 0.4 * land;
  const moist = layered(seed + 61, x, z, 140, 2) + ease(-3, 0, wet) * 0.12;
  const sand = Math.max(
    1 - ease(0.8, 1.7, elevation),
    ease(-0.9, -0.2, wet) * (1 - ease(0.2, 0.6, wet)) * 0.9
  );
  return {
    elevation,
    forest: wet < -0.6 ? ease(0.55, 0.68, moist) * land * (1 - sand) : 0,
    height: SEA + (inland ? bankOf(open, face, wet) : open),
    meadow:
      wet < -0.3
        ? ease(0.58, 0.7, layered(seed + 51, x, z, 36, 2)) * (1 - sand)
        : 0,
    moist,
    sand,
    // One level along a whole bank, so the shoreline is where the land crosses it.
    surface: SEA + (wet > -2.4 ? face : 0),
    wet,
  };
}

/**
 * Which way a river runs at a place, as a direction of length one, none where
 * no river flows: along the river's own line, toward lower land.
 */
export function flowOf(seed: number, x: number, z: number, wet: number) {
  if (wet <= 0 || Math.abs(riverOf(seed, x, z)) * 2 >= RIVER) {
    return [0, 0] as const;
  }
  const acrossX = riverOf(seed, x + 1, z) - riverOf(seed, x - 1, z);
  const acrossZ = riverOf(seed, x, z + 1) - riverOf(seed, x, z - 1);
  // Never zero in practice; the floor keeps a flat field from dividing by nothing.
  const length = Math.max(Math.hypot(acrossX, acrossZ), 1e-9);
  const alongX = -acrossZ / length;
  const alongZ = acrossX / length;
  const uphill =
    alongX * (elevationOf(seed, x + 3, z) - elevationOf(seed, x - 3, z)) +
    alongZ * (elevationOf(seed, x, z + 3) - elevationOf(seed, x, z - 3));
  return uphill > 0
    ? ([-alongX, -alongZ] as const)
    : ([alongX, alongZ] as const);
}
