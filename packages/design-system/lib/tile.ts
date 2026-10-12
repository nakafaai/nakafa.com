import type { IconSvgElement } from "@hugeicons/react";
import { Array as Arr, Equal, Hash, Order } from "effect";

/** A full turn is 360 degrees, whether it counts hues or gradient directions. */
const TURN = 360;
/** The second tone sits this many degrees to the left or the right of the first. */
const NEIGHBOUR = 34;
const SIDES = 2;
const DIRECTIONS = 8;

/** The ground tone starts the blend, and the lighter second tone ends it. */
const GROUND_LIGHTNESS = 0.56;
const GROUND_CHROMA = 0.12;
const SECOND_LIGHTNESS = 0.66;
const SECOND_CHROMA = 0.125;

/**
 * The least distance, in degrees, between the middles of the blends of two
 * tiles that sit in one list.
 *
 * Chosen by looking at rows of blends at 40px on a light and a dark ground, in
 * normal vision and in simulated protanopia, deuteranopia, and tritanopia
 * (Machado, Oliveira, and Fernandes, 2009, severity 1), and by measuring the
 * distance between two middles in OKLab, where 0.02 is the least that an eye
 * tells apart. At 36 degrees two middles differ by at least 0.067, and the two
 * blends, each 34 degrees wide, no longer overlap in hue. Seven tiles, the
 * longest list the product shows, keep that gap in all but about one list in
 * a thousand; a wider gap keeps it less often (96 lists in 100 at 40 degrees,
 * 63 at 45), and ten tiles fit around the wheel.
 *
 * Every tile has the same lightness and chroma, so no gap separates every pair
 * for a viewer who confuses red with green or blue with yellow: in
 * deuteranopia and tritanopia 17 and 18 of 100 neighbouring pairs fall under
 * 0.02, while protanopia keeps all of them above it (0.026 at the least). A
 * list never repeats an icon either, so those pairs still differ.
 */
export const TILE_HUE_GAP = 36;

/** Writes one tone in OKLCH. */
function tone(lightness: number, chroma: number, hue: number) {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/** Wraps an angle in degrees into 0 up to 359, also when it is negative. */
function wrap(degrees: number) {
  return ((degrees % TURN) + TURN) % TURN;
}

/**
 * Reads the hash of a seed as digits: one hue out of 360, the side of the
 * second tone, one of eight directions for the blend, and what is left, which
 * a list uses to start from one icon of a pool. `middle` is the hue halfway
 * between the two tones, which is the hue the eye takes the tile to have.
 */
function readSeed(seed: string) {
  const hash = Math.abs(Hash.string(seed));
  const hue = hash % TURN;
  const rest = Math.floor(hash / TURN);
  const lean = rest % SIDES === 0 ? -NEIGHBOUR : NEIGHBOUR;
  const aimed = Math.floor(rest / SIDES);

  return {
    direction: aimed % DIRECTIONS,
    hue,
    lean,
    middle: wrap(hue + lean / 2),
    spin: Math.floor(aimed / DIRECTIONS),
  };
}

/**
 * The CSS background of a content tile, made from its seed.
 *
 * The hash of the seed is read as three digits: one hue out of 360, the side of
 * the second tone, 34 degrees to the left or to the right of the first, and one
 * of eight directions for the soft blend between them. The same seed always
 * gives the same tile, and lightness and chroma never change, so every tile
 * belongs to one family and a white icon stays readable on it.
 *
 * @param seed - A key that does not change with language or edits, such as an id or a path
 * @param shift - Degrees to turn the whole blend around the hue wheel, from `getTileShifts`; the seed alone gives 0
 * @returns A `linear-gradient(...)` for `background-image`
 */
export function getTileGradient(seed: string, shift = 0) {
  const { direction, hue, lean } = readSeed(seed);
  const ground = wrap(hue + shift);
  const second = wrap(ground + lean);

  return `linear-gradient(${direction * (TURN / DIRECTIONS)}deg,${tone(GROUND_LIGHTNESS, GROUND_CHROMA, ground)},${tone(SECOND_LIGHTNESS, SECOND_CHROMA, second)})`;
}

/** The distance from a hue to the nearest of the others, around the wheel. */
function distanceToNearest(hue: number, others: readonly number[]) {
  return Arr.reduce(others, TURN, (nearest, other) => {
    const apart = Math.abs(hue - other);

    return Math.min(nearest, apart, TURN - apart);
  });
}

/**
 * The middle hue a tile takes after the tiles before it. It keeps its own when
 * none of them is within the gap, else it moves on around the wheel to the
 * next hue that none is, and when no hue has room it takes the one farthest
 * from the rest. A distance beyond the gap counts as the gap, so the first
 * hue with room wins.
 */
function placeMiddle(own: number, taken: readonly number[]) {
  return Arr.max(
    Arr.makeBy(TURN, (step) => wrap(own + step)),
    Order.mapInput(Order.Number, (hue: number) =>
      Math.min(distanceToNearest(hue, taken), TILE_HUE_GAP)
    )
  );
}

/**
 * How far to turn each tile of one list so that no two blends look alike.
 *
 * Each tile starts from the middle hue its own seed gives, so a tile that has
 * room keeps its look from visit to visit, and a tile whose middle is closer
 * than `TILE_HUE_GAP` to a tile before it moves on to the next free hue. A list
 * of up to six tiles always finds room, and seven do in all but about one list
 * in a thousand, the least distance then being 34 degrees. Past that, each
 * tile takes the hue farthest from the rest, so the least distance shrinks but
 * no two tiles share a hue.
 *
 * @param seeds - The seed of each tile, in list order
 * @returns The degrees to pass as `shift` to each tile, in the same order
 */
export function getTileShifts(seeds: readonly string[]) {
  const middles = Arr.reduce(seeds, Arr.empty<number>(), (taken, seed) =>
    Arr.append(taken, placeMiddle(readSeed(seed).middle, taken))
  );

  return Arr.zipWith(seeds, middles, (seed, middle) =>
    wrap(middle - readSeed(seed).middle)
  );
}

/**
 * The icon a tile takes from its pool after the tiles before it. The seed
 * picks where in the pool it starts; an icon that no tile before it holds
 * wins, and when every icon of the pool is held the least held one does, so a
 * list longer than its pool repeats an icon only as late and as evenly as it
 * must.
 */
function pickIcon(
  pool: Arr.NonEmptyReadonlyArray<IconSvgElement>,
  spin: number,
  taken: readonly IconSvgElement[]
) {
  const holders = (icon: IconSvgElement) =>
    Arr.filter(taken, (other) => Equal.equals(other, icon)).length;

  return Arr.min(
    Arr.rotate(pool, -(spin % pool.length)),
    Order.mapInput(Order.Number, holders)
  );
}

/**
 * What one tile tells `getTileLooks` about itself: the pool of icons its key
 * may show, best known first, and its seed.
 */
type TileRow = readonly [
  pool: Arr.NonEmptyReadonlyArray<IconSvgElement>,
  seed: string,
];

/**
 * What `getTileLooks` decides for one tile: the icon it shows, and the `seed`
 * and `shift` that its `Tile` takes. The seed comes back so that a tile is
 * never drawn from another seed than the one its list placed it by.
 */
export type TileLook = ReturnType<typeof getTileLooks>[number];

/**
 * The icon and the turn of each tile of one list, so that no two tiles of it
 * share an icon or a blend.
 *
 * The design system never decides what an icon means: the owner of a key
 * decides its pool, and this only keeps the tiles of one list apart.
 *
 * @param rows - Each tile's pool and seed, in list order
 * @returns Each tile's icon, seed, and `shift`, in the same order
 */
export function getTileLooks(rows: readonly TileRow[]) {
  const [, picked] = Arr.mapAccum(
    rows,
    Arr.empty<IconSvgElement>(),
    (taken, [pool, seed]) => {
      const icon = pickIcon(pool, readSeed(seed).spin, taken);

      return [Arr.append(taken, icon), { icon, seed }] as const;
    }
  );
  const shifts = getTileShifts(Arr.map(picked, ({ seed }) => seed));

  return Arr.zipWith(picked, shifts, ({ icon, seed }, shift) => ({
    icon,
    seed,
    shift,
  }));
}
