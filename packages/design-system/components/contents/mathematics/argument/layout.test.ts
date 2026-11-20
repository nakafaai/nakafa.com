// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  startSeats,
  toggle,
} from "@repo/design-system/components/contents/mathematics/argument/chain";
import type { ArgumentCard } from "@repo/design-system/components/contents/mathematics/argument/form";
import {
  CARD,
  capacity,
  EXTENT,
  handPlaces,
  LINK_GAP,
  LINK_ROWS,
  PITCH,
  PLATE,
  PLATE_ROWS,
  PRINT_SIZES,
  printOf,
  RAIL,
  SLOT_PLACES,
  slotsOf,
  TRAY,
  tableOf,
  viewDistance,
} from "@repo/design-system/components/contents/mathematics/argument/layout";
import { Array as Arr, Option } from "effect";

const card = (text: string): ArgumentCard => ({
  statement: { kind: "claim", negated: false, statement: text },
  text,
  truth: true,
});

describe("the table's places", () => {
  it("stacks the pockets first premise farthest, each plate just above its pocket", () => {
    expect(Arr.map(SLOT_PLACES, (place) => place.z)).toEqual([
      -PITCH,
      0,
      PITCH,
    ]);
    expect(PLATE_ROWS[1]).toBeCloseTo(-CARD.depth / 2 - PLATE / 2);
  });

  it("hangs each pair of links in the middle of the gap under a pocket", () => {
    expect(LINK_ROWS[0]).toBeCloseTo(-PITCH + CARD.depth / 2 + LINK_GAP / 2);
    expect(LINK_ROWS[1]).toBeCloseTo(CARD.depth / 2 + LINK_GAP / 2);
    expect(LINK_ROWS[1] + LINK_GAP / 2).toBeCloseTo(
      PITCH - CARD.depth / 2 - PLATE
    );
  });

  it("centres the hand beside the rail, a card a pocket apart", () => {
    expect(Arr.map(handPlaces(3), (place) => place.z)).toEqual([
      -PITCH,
      0,
      PITCH,
    ]);
    expect(Arr.map(handPlaces(2), (place) => place.z)).toEqual([
      -PITCH / 2,
      PITCH / 2,
    ]);
    expect(handPlaces(1)[0].z).toBe(0);
    expect(handPlaces(1)[0].x).toBeGreaterThan(SLOT_PLACES[0].x + CARD.width);
  });

  it("reaches about as far down the table as across it, so a square phone card fills", () => {
    expect(EXTENT.width / EXTENT.depth).toBeGreaterThan(0.9);
    expect(EXTENT.width / EXTENT.depth).toBeLessThan(1.1);
  });
});

describe("printing a card", () => {
  it("holds fewer letters at each smaller size's larger neighbour", () => {
    const [large, middle, small] = Arr.map(PRINT_SIZES, capacity);
    expect(large).toBeLessThan(middle);
    expect(middle).toBeLessThan(small);
    expect(large).toBeGreaterThanOrEqual(56);
  });

  it("prints short words large and long words smaller, wrapping inside the card", () => {
    const short = printOf("Semua gandaan 10 ialah gandaan 5");
    expect(short.size).toBe(PRINT_SIZES[0]);
    expect((short.width * short.size) / 16).toBeLessThan(CARD.width);
    expect(printOf("x".repeat(capacity(PRINT_SIZES[0]) + 1)).size).toBe(
      PRINT_SIZES[1]
    );
    expect(printOf("x".repeat(500)).size).toBe(PRINT_SIZES[2]);
  });
});

describe("the camera", () => {
  it("stands farther back on a narrow card than on a wide one", () => {
    expect(viewDistance(1, 1.3, 30)).toBeGreaterThan(
      viewDistance(1.43, 1.3, 30)
    );
    expect(viewDistance(0.5, 1.3, 30)).toBeGreaterThan(
      viewDistance(1, 1.3, 30)
    );
  });
});

describe("cards on the table", () => {
  const hand = [card("q"), card("p"), card("not q")];
  const fixed = [
    Option.some(card("if p then q")),
    Option.none(),
    Option.none(),
  ] as const;

  it("lays the lesson's cards in their pockets and the hand on the tray", () => {
    const table = tableOf(fixed, hand, startSeats([false, true, true]));
    expect(Arr.map(table, (each) => each.key)).toEqual([
      "slot-0",
      "hand-0",
      "hand-1",
      "hand-2",
    ]);
    expect(table[0]?.rest).toEqual({ ...SLOT_PLACES[0], y: RAIL.pocket });
    expect(table[1]?.rest).toEqual({ ...handPlaces(3)[0], y: TRAY.top });
    expect(table[1]?.slotted).toBe(false);
  });

  it("moves a dealt hand card into its pocket, keeping its place in the list", () => {
    const seats = toggle(startSeats([false, true, true]), 1);
    const table = tableOf(fixed, hand, seats);
    expect(table[2]?.key).toBe("hand-1");
    expect(table[2]?.rest).toEqual({ ...SLOT_PLACES[1], y: RAIL.pocket });
    expect(table[2]?.slotted).toBe(true);
  });

  it("fills each slot with its own card or the hand card dealt into it", () => {
    const seats = toggle(startSeats([false, true, true]), 1);
    const [first, second, last] = slotsOf(fixed, hand, seats);
    expect(Option.map(first, (each) => each.text)).toEqual(
      Option.some("if p then q")
    );
    expect(Option.map(second, (each) => each.text)).toEqual(Option.some("p"));
    expect(Option.isNone(last)).toBe(true);
  });
});
