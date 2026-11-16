import { describe, expect, it } from "@effect/vitest";
import { BRONZE, LID, POP, TEXT } from "@repo/mascot/color";
import { MEDAL_BOX, medal } from "@repo/mascot/medal/draw";
import { MEDALS, MedalSchema } from "@repo/mascot/medal/name";
import type { Shape } from "@repo/mascot/shape";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Order, Record as Rec } from "effect";

/** Every colour a picture paints with, through its groups. */
function colours(shapes: readonly Shape[]): readonly string[] {
  return Arr.flatMap(shapes, (shape) =>
    shape._tag === "g"
      ? colours(shape.children)
      : Arr.filter(
          [shape.fill, shape.stroke],
          (colour): colour is string =>
            colour !== undefined && colour !== "none"
        )
  );
}

describe("mascot/medal", () => {
  it("has a design for every medal, and a window taller than it is wide for the ribbon", () => {
    expect(Arr.sort(Rec.keys(MEDALS), Order.String)).toEqual(
      Arr.sort(MedalSchema.literals, Order.String)
    );
    expect(MEDAL_BOX[3]).toBeGreaterThan(MEDAL_BOX[2]);
  });

  it("draws every earned medal in colour, each differently, and the same each time", () => {
    const pictures = Arr.map(MedalSchema.literals, (name) => medal(name, 1));
    expect(
      Arr.dedupe(Arr.map(pictures, (picture) => encodeJsonText(picture)))
    ).toHaveLength(MedalSchema.literals.length);
    for (const name of MedalSchema.literals) {
      expect(medal(name, 1)).toEqual(medal(name, 1));
      expect(colours(medal(name, 1))).toContain(MEDALS[name].face);
      expect(colours(medal(name, 1))).not.toContain(TEXT);
    }
  });

  it("draws a medal still to earn only in the colour of the text round it", () => {
    for (const name of MedalSchema.literals) {
      expect(Arr.dedupe(colours(medal(name, 0)))).toEqual([TEXT]);
    }
  });

  it("says the tier on the medal: a star more each tier, a new metal every three, and no last tier", () => {
    const tiers = Arr.map(Arr.range(1, 30), (tier) =>
      encodeJsonText(medal("lessons", tier))
    );
    // Three stars, three metals and three rims: 27 medals before one comes round again.
    expect(Arr.dedupe(tiers)).toHaveLength(27);
    expect(tiers[27]).toBe(tiers[0]);
    const rimOf = (tier: number) => colours(medal("streak", tier))[2];
    expect(Arr.map([1, 3, 4, 6, 7, 9, 10], rimOf)).toEqual([
      BRONZE,
      BRONZE,
      LID,
      LID,
      POP.yellow,
      POP.yellow,
      BRONZE,
    ]);
    expect(medal("days", 2).length - medal("days", 1).length).toBe(2);
    expect(medal("days", 4).length).toBe(medal("days", 1).length);
  });
});
