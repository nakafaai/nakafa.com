// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arrangementAt,
  arrangements,
  cardOf,
  changedCard,
  HOLD,
  picked,
  seatOf,
  startSeats,
  toggle,
} from "@repo/design-system/components/contents/mathematics/argument/chain";
import { Array as Arr, Option } from "effect";

const cards = (seats: ReturnType<typeof startSeats>) =>
  Arr.map(seats, (seat) => Option.getOrUndefined(cardOf(seat)));

describe("dealing the hand into the chain", () => {
  it("starts with the lesson's slots fixed and every open slot empty", () => {
    const seats = startSeats([true, false, true]);
    expect(Arr.map(seats, (seat) => seat._tag)).toEqual([
      "open",
      "fixed",
      "open",
    ]);
    expect(cards(seats)).toEqual([undefined, undefined, undefined]);
  });

  it("fills the first empty open slot, and takes a card back when pressed again", () => {
    const seats = startSeats([true, false, true]);
    const one = toggle(seats, 2);
    expect(cards(one)).toEqual([2, undefined, undefined]);
    const two = toggle(one, 0);
    expect(cards(two)).toEqual([2, undefined, 0]);
    expect(seatOf(two, 0)).toEqual(Option.some(2));
    expect(picked(two)).toEqual([2, 0]);
    expect(cards(toggle(two, 2))).toEqual([undefined, undefined, 0]);
  });

  it("swaps the last open slot's card once every open slot is full", () => {
    const one = toggle(startSeats([false, false, true]), 0);
    expect(cards(toggle(one, 1))).toEqual([undefined, undefined, 1]);
  });

  it("leaves a chain with no open slot as it is", () => {
    const seats = startSeats([false, false, false]);
    expect(toggle(seats, 0)).toEqual(seats);
  });
});

describe("the toolbar's toggles", () => {
  it("finds the card whose toggle changed, pressed or released", () => {
    const seats = toggle(startSeats([false, true, true]), 1);
    expect(changedCard(seats, 3, ["1", "2"])).toEqual(Option.some(2));
    expect(changedCard(seats, 3, [])).toEqual(Option.some(1));
    expect(changedCard(seats, 3, ["1"])).toEqual(Option.none());
  });
});

describe("playing every way to fill the chain", () => {
  it("starts empty, then deals every card into one open slot", () => {
    const list = arrangements(startSeats([false, false, true]), 3);
    expect(Arr.map(list, cards)).toEqual([
      [undefined, undefined, undefined],
      [undefined, undefined, 0],
      [undefined, undefined, 1],
      [undefined, undefined, 2],
    ]);
  });

  it("deals every ordered pair into two open slots, never one card twice", () => {
    const list = arrangements(toggle(startSeats([true, true, false]), 1), 3);
    expect(list).toHaveLength(7);
    expect(Arr.map(list, cards)[0]).toEqual([undefined, undefined, undefined]);
    expect(Arr.map(list, cards)).toContainEqual([2, 0, undefined]);
    expect(
      Arr.every(Arr.drop(list, 1), (seats) => {
        const [one, two] = picked(seats);
        return one !== two;
      })
    ).toBe(true);
  });

  it("leaves the last open slots empty when the hand is smaller", () => {
    const list = arrangements(startSeats([true, true, true]), 1);
    expect(Arr.map(list, cards)).toEqual([
      [undefined, undefined, undefined],
      [0, undefined, undefined],
    ]);
  });

  it("holds each way for its moment, and the last to the end", () => {
    expect(arrangementAt(4, 0)).toBe(0);
    expect(arrangementAt(4, HOLD * 1.5)).toBe(1);
    expect(arrangementAt(4, HOLD * 9)).toBe(3);
    expect(arrangementAt(4, -1)).toBe(0);
  });
});
