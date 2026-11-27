/**
 * The scalar fields every procedural surface of a lab is made of:
 * smooth gradient noise, its fractal sums, ridges, cells and a warp. Each
 * answers the same number for the same place and seed on every device, so a
 * surface looks the same on every visit and in every test, and nothing is
 * downloaded. The fields over a tile repeat every whole tile, so a texture
 * painted from them has no seam.
 */

/** A well-scattered whole number from 0 to 2^32 - 1 for three whole numbers. */
function scatter(x: number, y: number, seed: number) {
  // biome-ignore-start lint/suspicious/noBitwiseOperators: an integer hash is defined by 32-bit shifts and XOR, which answer the same bits on every device where a sine would not.
  const mixed =
    Math.imul(x, 0x27_d4_eb_2d) ^
    Math.imul(y, 0x16_56_67_b1) ^
    Math.imul(seed, 0x9e_37_79_b1);
  const first = Math.imul(mixed ^ (mixed >>> 15), 0x85_eb_ca_6b);
  const second = Math.imul(first ^ (first >>> 13), 0xc2_b2_ae_35);
  return (second ^ (second >>> 16)) >>> 0;
  // biome-ignore-end lint/suspicious/noBitwiseOperators: the hash ends here.
}

/**
 * A number in [0, 1) that one whole-numbered place always answers, with no
 * likeness to its neighbours: which way a lattice corner leans, where the
 * point of a cell lies, how pale one board of a floor is.
 */
export function chanceAt(x: number, y: number, seed: number) {
  return scatter(x, y, seed) / 4_294_967_296;
}

/** The remainder of a whole number in a period, never negative. */
function wrap(value: number, period: number) {
  return ((value % period) + period) % period;
}

/** The fade that joins lattice cells with no crease in slope or curvature. */
function fade(along: number) {
  return along * along * along * (along * (along * 6 - 15) + 10);
}

/** How many directions a lattice corner's gradient chooses from. */
const DIRECTIONS = 256;

/** The unit gradients a lattice corner chooses from, as x then y, evenly around the circle. */
const GRADIENTS = Float64Array.from({ length: DIRECTIONS * 2 }, (_, index) => {
  const angle = (Math.floor(index / 2) / DIRECTIONS) * 2 * Math.PI;
  return index % 2 === 0 ? Math.cos(angle) : Math.sin(angle);
});

/**
 * How far a point lies along the unit gradient of one lattice corner: the
 * corner's gradient points the way its hash chooses.
 */
function lean(
  cornerX: number,
  cornerY: number,
  seed: number,
  offsetX: number,
  offsetY: number
) {
  const direction = (scatter(cornerX, cornerY, seed) % DIRECTIONS) * 2;
  return (
    Number(GRADIENTS[direction]) * offsetX +
    Number(GRADIENTS[direction + 1]) * offsetY
  );
}

/**
 * Smooth gradient noise at a place, between 0 and 1 and 0.5 on average, that
 * repeats every `across` lattice cells one way and every `along` the other.
 * Unlike value noise it has no blocky plateaus along the lattice, so relief
 * painted from it catches the light like a real surface.
 */
export function gradientAt(
  x: number,
  y: number,
  across: number,
  along: number,
  seed: number
) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const right = x - left;
  const down = y - top;
  const west = wrap(left, across);
  const east = wrap(left + 1, across);
  const north = wrap(top, along);
  const south = wrap(top + 1, along);
  const easeX = fade(right);
  const first = lean(west, north, seed, right, down);
  const upper =
    first + (lean(east, north, seed, right - 1, down) - first) * easeX;
  const third = lean(west, south, seed, right, down - 1);
  const lower =
    third + (lean(east, south, seed, right - 1, down - 1) - third) * easeX;
  const value = upper + (lower - upper) * fade(down);
  return 0.5 + value * Math.SQRT1_2;
}

/**
 * Fractal detail at a place of a tile, between 0 and 1: `layers` of gradient
 * noise, each twice as fine and half as strong as the one before, the
 * broadest with `across` by `along` cells over the tile. `x` and `y` run
 * from 0 to 1 across the tile. Unequal counts stretch the detail into
 * streaks, as brushed metal and the pores of wood are streaked.
 */
export function fractalAt(
  x: number,
  y: number,
  across: number,
  along: number,
  seed: number,
  layers = 4
) {
  let sum = 0;
  let total = 0;
  let strength = 1;
  let fine = 1;
  for (let layer = 0; layer < layers; layer += 1) {
    sum +=
      gradientAt(
        x * across * fine,
        y * along * fine,
        across * fine,
        along * fine,
        seed + layer
      ) * strength;
    total += strength;
    strength /= 2;
    fine *= 2;
  }
  return sum / total;
}

/**
 * Ridges at a place of a tile, between 0 and 1: sharp crests where each layer
 * of gradient noise crosses its middle, each finer layer strongest on the
 * crests of the one before, as eroded rock, bark and veins are. 1 is a crest.
 */
export function ridgedAt(
  x: number,
  y: number,
  across: number,
  along: number,
  seed: number,
  layers = 4
) {
  let sum = 0;
  let total = 0;
  let strength = 1;
  let weight = 1;
  let fine = 1;
  for (let layer = 0; layer < layers; layer += 1) {
    const middle = gradientAt(
      x * across * fine,
      y * along * fine,
      across * fine,
      along * fine,
      seed + layer
    );
    const crest = (1 - Math.abs(2 * middle - 1)) ** 2;
    sum += crest * strength * weight;
    total += strength;
    weight = Math.min(1, crest * 2);
    strength /= 2;
    fine *= 2;
  }
  return sum / total;
}

/**
 * The cells of a tile at a place, as a mosaic of `across` by `along` cells
 * around scattered points: how far the place is from the nearest point and
 * from the second nearest, in cell widths, and a number between 0 and 1 the
 * nearest cell owns. The nearest distance draws pebbles, pores and scales;
 * the gap between the two draws the cracks and walls between cells. Unequal
 * counts stretch the cells, as the plates of bark and the fibres of muscle
 * are stretched.
 */
export function cellsAt(
  x: number,
  y: number,
  across: number,
  along: number,
  seed: number
) {
  const placeX = x * across;
  const placeY = y * along;
  const cellX = Math.floor(placeX);
  const cellY = Math.floor(placeY);
  let nearest = Number.POSITIVE_INFINITY;
  let second = Number.POSITIVE_INFINITY;
  let ownerX = 0;
  let ownerY = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const wrappedX = wrap(cellX + dx, across);
      const wrappedY = wrap(cellY + dy, along);
      const point = scatter(wrappedX, wrappedY, seed);
      const reachX = cellX + dx + (point % 65_536) / 65_536 - placeX;
      const reachY = cellY + dy + Math.floor(point / 65_536) / 65_536 - placeY;
      const distance = reachX * reachX + reachY * reachY;
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        ownerX = wrappedX;
        ownerY = wrappedY;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return {
    nearest: Math.sqrt(nearest),
    owner: chanceAt(ownerX, ownerY, seed + 1),
    second: Math.sqrt(second),
  };
}

/**
 * Fractal detail whose place is first pushed around by two other fractals,
 * between 0 and 1: the swirls and folds of marble, wood figure, clouds and
 * tissue. `bend` is how far the place moves, in tiles; the result still
 * repeats every whole tile.
 */
export function warpedAt(
  x: number,
  y: number,
  across: number,
  along: number,
  seed: number,
  bend: number
) {
  const pushX = fractalAt(x, y, across, along, seed + 101, 3) - 0.5;
  const pushY = fractalAt(x, y, across, along, seed + 211, 3) - 0.5;
  return fractalAt(x + bend * pushX, y + bend * pushY, across, along, seed);
}
