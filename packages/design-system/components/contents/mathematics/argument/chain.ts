import { Array as Arr, Option, Schema } from "effect";

/**
 * One slot of the chain: one the lesson fills with its own card, or one the
 * learner fills from the hand, which holds the place of a hand card or stays
 * empty.
 */
const SeatSchema = Schema.Union([
  Schema.TaggedStruct("fixed", {}),
  Schema.TaggedStruct("open", { card: Schema.Option(Schema.Int) }),
]);
export type Seat = typeof SeatSchema.Type;

/** How long Play holds each way of filling the chain, in seconds. */
export const HOLD = 2;

const empty: Seat = { _tag: "open", card: Option.none() };
const fixed: Seat = { _tag: "fixed" };

const isOpen = (seat: Seat) => seat._tag === "open";

/** The chain as it starts: the lesson's cards in their slots and every open slot empty. */
export function startSeats(open: readonly boolean[]) {
  return Arr.map(open, (each) => (each ? empty : fixed));
}

/** The card a slot holds from the hand, if any. */
export function cardOf(seat: Seat) {
  return seat._tag === "open" ? seat.card : Option.none();
}

/** The slot that holds a hand card, if it is in the chain. */
export function seatOf(seats: readonly Seat[], card: number) {
  return Arr.findFirstIndex(seats, (seat) =>
    Option.contains(cardOf(seat), card)
  );
}

/** The hand cards in the chain, in slot order. */
export function picked(seats: readonly Seat[]) {
  return Arr.getSomes(Arr.map(seats, cardOf));
}

const holding = (card: number): Seat => ({
  _tag: "open",
  card: Option.some(card),
});

/**
 * Moves one hand card: out of the chain if it is in, otherwise into the
 * first empty open slot, or, once every open slot is full, into the last
 * one, whose card goes back to the hand. With one open slot the hand reads
 * as a choice of one.
 */
export function toggle(seats: readonly Seat[], card: number) {
  return Option.match(seatOf(seats, card), {
    onNone: () => {
      const target = Option.orElse(
        Arr.findFirstIndex(
          seats,
          (seat) => isOpen(seat) && Option.isNone(cardOf(seat))
        ),
        () => Arr.findLastIndex(seats, isOpen)
      );
      return Option.match(target, {
        onNone: () => [...seats],
        onSome: (index) => Arr.replace(seats, index, holding(card)),
      });
    },
    onSome: (index) => Arr.replace(seats, index, empty),
  });
}

/**
 * The hand card a toolbar change moved: the one whose pressed state differs
 * between the toggles' new values and the cards in the chain now.
 */
export function changedCard(
  seats: readonly Seat[],
  hand: number,
  next: readonly string[]
) {
  const now = picked(seats);
  return Arr.findFirst(
    Arr.makeBy(hand, (card) => card),
    (card) => Arr.contains(next, String(card)) !== Arr.contains(now, card)
  );
}

/** Every ordered pick of `count` different cards from a hand of `size`. */
function picks(size: number, count: number): readonly (readonly number[])[] {
  if (count === 0) {
    return [[]];
  }
  return Arr.flatMap(
    Arr.makeBy(size, (card) => card),
    (card) =>
      Arr.map(
        Arr.filter(picks(size, count - 1), (rest) => !Arr.contains(rest, card)),
        (rest) => [card, ...rest]
      )
  );
}

/**
 * The chains Play steps through, each held `HOLD` seconds: the chain with
 * its open slots empty, then every way to fill them from the hand, a hand
 * smaller than the open slots leaving the last of them empty.
 */
export function arrangements(seats: readonly Seat[], hand: number) {
  const start = startSeats(Arr.map(seats, isOpen));
  const open = Arr.filter(seats, isOpen).length;
  const filled = Arr.map(picks(hand, Math.min(hand, open)), (pick) =>
    Arr.map(start, (seat, index) => {
      if (!isOpen(seat)) {
        return seat;
      }
      const order = Arr.filter(Arr.take(seats, index), isOpen).length;
      return Option.match(Arr.get(pick, order), {
        onNone: () => empty,
        onSome: holding,
      });
    })
  );
  return [start, ...filled];
}

/** Which of `count` arrangements Play shows at `time`, the last held to the end. */
export function arrangementAt(count: number, time: number) {
  return Math.min(count - 1, Math.max(0, Math.floor(time / HOLD)));
}
