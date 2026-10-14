import type { IconSvgElement } from "@hugeicons/react";
import { readSeed, TURN, wrap } from "@repo/design-system/lib/tile";
import { Array as Arr, Equal, Order, Predicate, Tuple } from "effect";

/**
 * The least distance, in degrees, between the middles of the blends of two
 * tiles that sit in one list.
 *
 * At 36 degrees two middles differ by at least 0.067 in OKLab, where 0.02 is
 * the least that an eye tells apart, and the two blends no longer overlap in
 * hue. A wider gap keeps fewer lists.
 *
 * What a list keeps depends on its length, since ten gaps of 36 degrees fill
 * the wheel. A list of up to six tiles always keeps the gap: five tiles hide at
 * most 355 of the 360 hues, so a sixth always finds one. A longer list keeps it
 * only when its seeds fall well, and the longest real lists do: the Merdeka
 * classes that draw tiles and the sections of a UTBK-SNBT set. Past the last
 * free hue a tile takes the hue farthest from the rest, so the least distance
 * shrinks but no two tiles share a hue.
 */
export const TILE_HUE_GAP = 36;

/** The distance from a hue to the nearest of the others, around the wheel. */
function distanceToNearest(hue: number, others: readonly number[]) {
  return Arr.reduce(others, TURN, (nearest, other) => {
    const apart = Math.abs(hue - other);

    return Math.min(nearest, apart, TURN - apart);
  });
}

/** How much room a hue has from the others, where a distance beyond the gap counts as the gap. */
function roomFrom(others: readonly number[]) {
  return Order.mapInput(Order.Number, (hue: number) =>
    Math.min(distanceToNearest(hue, others), TILE_HUE_GAP)
  );
}

/**
 * The middle hue a tile takes after the tiles before it in its list, and the
 * tiles that its page already shows. It keeps its own when none of them is
 * within the gap. Otherwise it moves on around the wheel to the next hue that
 * has room from the tiles of its list, and among those to the next that also
 * has room from the tiles of the page, or when none has, to the one farthest
 * from them. When no hue has room in its list, it takes the one farthest from
 * the rest of the list, and then the one farthest from the page. The first of
 * equal hues in that walk wins, so a tile that has room never moves.
 */
function placeMiddle(
  own: number,
  taken: readonly number[],
  shown: readonly number[]
) {
  return Arr.max(
    Arr.makeBy(TURN, (step) => wrap(own + step)),
    Order.combine(roomFrom(taken), roomFrom(shown))
  );
}

/**
 * What a list decides for one tile: the icon it shows, and the `seed` and
 * `shift` that its `Tile` takes. The seed comes back so that a tile is never
 * drawn from another seed than the one its list placed it by.
 */
function look(icon: IconSvgElement, seed: string, shift: number) {
  return { icon, seed, shift };
}

/** The icon and the turn that a list gave to one tile. */
export type TileLook = ReturnType<typeof look>;

/** The middle hue that a tile is drawn with, from its seed and its turn. */
function middleOf({ seed, shift }: Pick<TileLook, "seed" | "shift">) {
  return wrap(readSeed(seed).middle + shift);
}

/** How far a tile turns, from the middle its seed gives to the middle its list placed it at. */
function turnOf(seed: string, middle: number) {
  return wrap(middle - readSeed(seed).middle);
}

/**
 * How far to turn each tile of one list so that no two blends look alike.
 *
 * Each tile starts from the middle hue its own seed gives, so a tile that has
 * room keeps its look from visit to visit, and a tile whose middle is closer
 * than `TILE_HUE_GAP` to a tile before it moves on to the next free hue.
 * A page that shows more than one list passes the tiles of the lists before
 * this one as `shown`: a tile then also prefers a hue that has room from them,
 * but the gap inside its own list comes first and never gives way.
 *
 * A row that is an object draws no tile, such as a catalog card that draws
 * reviewed artwork and hands over its source in an object. It comes back
 * unchanged in its place and takes no hue, so the tiles around it are placed as
 * if it were not in the list.
 *
 * `TILE_HUE_GAP` says what a list keeps by its length, up to the longest list
 * of the corpus.
 *
 * @param rows - The seed of each tile, in list order, or the object of a card that draws no tile
 * @param shown - The tiles that the page already shows before this list
 * @returns The degrees to pass as `shift` to each tile, and each object as it came, in the same order
 */
export function getTileShifts(
  rows: readonly string[],
  shown?: readonly Pick<TileLook, "seed" | "shift">[]
): readonly number[];
export function getTileShifts<Passed extends object>(
  rows: readonly (string | Passed)[],
  shown?: readonly Pick<TileLook, "seed" | "shift">[]
): readonly (number | Passed)[];
export function getTileShifts(
  rows: readonly (string | object)[],
  shown: readonly Pick<TileLook, "seed" | "shift">[] = []
): readonly (number | object)[] {
  const onPage = Arr.map(shown, middleOf);
  const [, shifts] = Arr.mapAccum(
    rows,
    Arr.empty<number>(),
    (taken, row): readonly [readonly number[], number | object] => {
      if (!Predicate.isString(row)) {
        return Tuple.make(taken, row);
      }
      const middle = placeMiddle(readSeed(row).middle, taken, onPage);

      return Tuple.make(Arr.append(taken, middle), turnOf(row, middle));
    }
  );

  return shifts;
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
  seed: string,
  taken: readonly IconSvgElement[]
) {
  const holders = (icon: IconSvgElement) =>
    Arr.filter(taken, (other) => Equal.equals(other, icon)).length;

  return Arr.min(
    Arr.rotate(pool, -(readSeed(seed).spin % pool.length)),
    Order.mapInput(Order.Number, holders)
  );
}

/**
 * The icon that a tile on its own takes from its pool: the one its seed points
 * at. A list gives the same icon to a tile that has no earlier tile to avoid.
 */
export function getTileIcon(
  pool: Arr.NonEmptyReadonlyArray<IconSvgElement>,
  seed: string
) {
  return pickIcon(pool, seed, Arr.empty());
}

/**
 * What `getTileLooks` reads of one tile: the pool of icons its key may show,
 * best known first, and its seed.
 */
export type TileRow = readonly [
  pool: Arr.NonEmptyReadonlyArray<IconSvgElement>,
  seed: string,
];

/**
 * The icon and the turn of each tile of one list, so that no two tiles of it
 * share an icon or a blend, and none of them shares one with a tile that the
 * page already shows.
 *
 * The design system never decides what an icon means: the owner of a key
 * decides its pool, and this only keeps the tiles apart. An icon that a shown
 * tile or an earlier tile holds is skipped while the pool has a free one, and
 * a list longer than what its pool has left repeats the least held icon first.
 *
 * A row that is a string draws no tile, such as a catalog card that draws
 * reviewed artwork and passes its source. It comes back unchanged in its place
 * and takes no icon and no hue, so the tiles around it are placed as if it were
 * not in the list.
 *
 * @param rows - Each tile's pool and seed, in list order, or the string of a card that draws no tile
 * @param shown - The looks of the tiles that the page already shows before this list
 * @returns Each tile's icon, seed, and `shift`, and each string as it came, in the same order
 */
export function getTileLooks(
  rows: readonly TileRow[],
  shown?: readonly TileLook[]
): readonly TileLook[];
export function getTileLooks<Passed extends string>(
  rows: readonly (TileRow | Passed)[],
  shown?: readonly TileLook[]
): readonly (TileLook | Passed)[];
export function getTileLooks(
  rows: readonly (TileRow | string)[],
  shown: readonly TileLook[] = []
): readonly (TileLook | string)[] {
  const onPage = Arr.map(shown, middleOf);
  const start = Tuple.make(
    Arr.map(shown, ({ icon }) => icon),
    Arr.empty<number>()
  );
  const [, looks] = Arr.mapAccum(
    rows,
    start,
    (placed, row): readonly [typeof start, TileLook | string] => {
      if (Predicate.isString(row)) {
        return Tuple.make(placed, row);
      }
      const [icons, middles] = placed;
      const [pool, seed] = row;
      const middle = placeMiddle(readSeed(seed).middle, middles, onPage);
      const icon = pickIcon(pool, seed, icons);

      return Tuple.make(
        Tuple.make(Arr.append(icons, icon), Arr.append(middles, middle)),
        look(icon, seed, turnOf(seed, middle))
      );
    }
  );

  return looks;
}
