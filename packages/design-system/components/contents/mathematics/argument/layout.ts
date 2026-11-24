import type { Seat } from "@repo/design-system/components/contents/mathematics/argument/chain";
import {
  cardOf,
  seatOf,
} from "@repo/design-system/components/contents/mathematics/argument/chain";
import type { ArgumentCard } from "@repo/design-system/components/contents/mathematics/argument/form";
import { Array as Arr, Option, Schema } from "effect";

/**
 * Where everything lies on the table, in metres, seen from above: the oak
 * rail with its three pockets down the left, first premise farthest, and the
 * felt tray with the hand down the right. The camera's forward is +z, so the
 * first premise reads at the top of the card, as a textbook writes it.
 */

/** An index card: across, deep, and how thick its board is. */
export const CARD = { depth: 0.08, thickness: 0.0018, width: 0.15 } as const;

/** The top of the oak rail and of the felt pockets let into it, above the table. */
export const RAIL = { pocket: 0.0126, top: 0.012 } as const;

/** The top of the felt tray the hand lies on. */
export const TRAY = { top: 0.004 } as const;

/** The brass plate over each pocket, which carries the slot's name. */
export const PLATE = 0.02;

/** The gap between one pocket and the plate under it, where the links hang. */
export const LINK_GAP = 0.03;

/** The gap between the rail's column and the hand's. */
const COLUMN_GAP = 0.046;

/** How far the rail and the tray reach past what they hold. */
export const RIM = 0.007;

/** The index tab on a hand card's right edge: how far it sticks out and how deep it is. */
export const TAB = { depth: 0.022, reach: 0.011 } as const;

/**
 * The shapes punched on the hand cards' index tabs, first card first. The
 * toolbar's toggle for each card shows its shape, so the learner can find it.
 */
export const ShapeSchema = Schema.Literals(["circle", "triangle", "square"]);
export type Shape = typeof ShapeSchema.Type;

/** How far one pocket's middle lies from the next. */
export const PITCH = CARD.depth + PLATE + LINK_GAP;

/** The middle of the rail's column and of the hand's, across the table. */
export const COLUMNS = {
  hand: (CARD.width + COLUMN_GAP) / 2,
  rail: -(CARD.width + COLUMN_GAP) / 2,
} as const;

/** The depth of each pocket's middle, first premise first. */
export const ROWS = [-PITCH, 0, PITCH] as const;

/** Where the cards of a hand of `count` wait on the tray, centred beside the rail. */
export function handPlaces(count: number) {
  return Arr.makeBy(count, (index) => ({
    x: COLUMNS.hand,
    z: (index - (count - 1) / 2) * PITCH,
  }));
}

/** The middle of each pocket, where a card in the chain lies. */
export const SLOT_PLACES = Arr.map(ROWS, (z) => ({ x: COLUMNS.rail, z }));

/** The depth of the middle of each pocket's brass plate. */
export const PLATE_ROWS = Arr.map(ROWS, (z) => z - CARD.depth / 2 - PLATE / 2);

/** The depth of the middle of the gap above the second and the third pocket, where their links hang. */
export const LINK_ROWS = Arr.map(
  [ROWS[0], ROWS[1]],
  (z) => z + CARD.depth / 2 + LINK_GAP / 2
);

/** How far everything on the table reaches, so the camera can take it all in. */
export const EXTENT = {
  depth: 2 * PITCH + CARD.depth + PLATE + 2 * RIM,
  middle: {
    x: TAB.reach / 2,
    z: -PLATE / 2,
  },
  width: 2 * CARD.width + COLUMN_GAP + 2 * RIM + TAB.reach,
} as const;

/** The inset of a card's words from its edges. */
const PAD = 0.009;

/** The height of a line of a card's words, as a share of its print size. */
const LINE_HEIGHT = 1.25;

/** The width of an average letter of Inter in running text, as a share of its size. */
const LETTER = 0.55;

/** The share of a line that words fill once they wrap at spaces. */
const FILL = 0.85;

/** The print sizes a card may use, largest first, in metres. */
export const PRINT_SIZES = [0.0125, 0.011, 0.0098] as const;

/** How many letters a card holds at one print size. */
export function capacity(size: number) {
  const across = CARD.width - 2 * PAD;
  const down = CARD.depth - 2 * PAD;
  const lines = Math.floor(down / (size * LINE_HEIGHT));
  return Math.floor(lines * (across / (size * LETTER)) * FILL);
}

/**
 * How a card prints its words: the largest size at which they fit, or the
 * smallest for words longer than any size holds, and the width the words
 * wrap within, in the label's own pixels at its 16 pixel base.
 */
export function printOf(text: string) {
  const size = Option.getOrElse(
    Arr.findFirst(PRINT_SIZES, (each) => capacity(each) >= text.length),
    () => PRINT_SIZES[2]
  );
  return {
    size,
    width: ((CARD.width - 2 * PAD) * 16) / size,
  };
}

/**
 * How far back the camera stands to take in the whole table on a canvas of
 * `aspect` width to height, looking down at `elevation` radians through a
 * vertical field of `fov` degrees, with a margin round the edge.
 */
export function viewDistance(aspect: number, elevation: number, fov: number) {
  const half = Math.tan((fov * Math.PI) / 360);
  const down = (EXTENT.depth / 2) * Math.sin(elevation);
  const across = EXTENT.width / 2;
  return Math.max(down / half, across / (half * aspect)) * 1.05;
}

/**
 * Every card on the table and where it rests: each slot's own card in its
 * pocket, then each hand card in the pocket that holds it or in its place on
 * the tray. A hand card keeps its place in the list wherever it rests, so it
 * glides between the two.
 */
export function tableOf(
  fixed: readonly Option.Option<ArgumentCard>[],
  hand: readonly ArgumentCard[],
  seats: readonly Seat[]
) {
  const waits = handPlaces(hand.length);
  const own = Arr.getSomes(
    Arr.map(fixed, (slot, index) =>
      Option.map(slot, (card) => ({
        card,
        hand: Option.none<number>(),
        key: `slot-${index}`,
        rest: { ...Arr.getUnsafe(SLOT_PLACES, index), y: RAIL.pocket },
        slotted: true,
      }))
    )
  );
  const held = Arr.map(hand, (card, index) =>
    Option.match(seatOf(seats, index), {
      onNone: () => ({
        card,
        hand: Option.some(index),
        key: `hand-${index}`,
        rest: { ...Arr.getUnsafe(waits, index), y: TRAY.top },
        slotted: false,
      }),
      onSome: (slot) => ({
        card,
        hand: Option.some(index),
        key: `hand-${index}`,
        rest: { ...Arr.getUnsafe(SLOT_PLACES, slot), y: RAIL.pocket },
        slotted: true,
      }),
    })
  );
  return [...own, ...held];
}

/**
 * The card each slot holds, first premise, second premise, conclusion: its
 * own card, the hand card put in it, or none yet.
 */
export function slotsOf(
  fixed: readonly [
    Option.Option<ArgumentCard>,
    Option.Option<ArgumentCard>,
    Option.Option<ArgumentCard>,
  ],
  hand: readonly ArgumentCard[],
  seats: readonly Seat[]
) {
  const fill = (index: 0 | 1 | 2) =>
    Option.orElse(fixed[index], () =>
      Option.flatMap(Option.flatMap(Arr.get(seats, index), cardOf), (card) =>
        Arr.get(hand, card)
      )
    );
  return [fill(0), fill(1), fill(2)] as const;
}
