import { describe, expect, it } from "@effect/vitest";
import type { Shape } from "@repo/mascot/shape";
import { BAG } from "@repo/mascot/thing/bag";
import { DESK } from "@repo/mascot/thing/desk";
import { HELD } from "@repo/mascot/thing/held";
import type { Mark } from "@repo/mascot/thing/mark";
import { ThingNameSchema } from "@repo/mascot/thing/name";
import { PICTURES } from "@repo/mascot/thing/picture";
import { PRODUCT } from "@repo/mascot/thing/product";
import { Array as Arr, Option, Order, Record as Rec } from "effect";

/** The things that have lines which draw themselves, and how many lines each has. */
const DRAWING: Readonly<Record<string, number>> = {
  calendar: 1,
  check: 1,
  highlighter: 1,
  note: 3,
  pencil: 1,
  shield: 1,
};

/** Every shape of a picture, the shapes of a group among them. */
function allShapes(shapes: readonly Shape<Mark>[]): readonly Shape<Mark>[] {
  return Arr.flatMap(shapes, (shape) =>
    shape._tag === "g" ? [shape, ...allShapes(shape.children)] : [shape]
  );
}

describe("the pictures of the things", () => {
  it("give every thing something to draw", () => {
    expect(ThingNameSchema.literals).toHaveLength(32);
    expect(
      Arr.every(ThingNameSchema.literals, (name) =>
        Arr.isReadonlyArrayNonEmpty(PICTURES[name])
      )
    ).toBe(true);
  });

  it("are drawn by exactly one of the four groups each, so that no group hides the picture of another", () => {
    const groups: readonly Readonly<Record<string, unknown>>[] = [
      BAG,
      DESK,
      HELD,
      PRODUCT,
    ];
    const names = Arr.flatMap(groups, (group) => Rec.keys(group));
    expect(Arr.sort(names, Order.String)).toEqual(
      Arr.sort(ThingNameSchema.literals, Order.String)
    );
  });

  it("measure each line that draws itself as one unit long, for the dash that hides it to fit, in these things and in no other", () => {
    for (const name of ThingNameSchema.literals) {
      const drawing = Arr.filter(
        allShapes(PICTURES[name]),
        (shape) => shape.mark?.motion === "draw"
      );
      expect(Arr.length(drawing), name).toBe(
        Option.getOrElse(Rec.get(DRAWING, name), () => 0)
      );
      expect(
        Arr.every(
          drawing,
          (shape) => shape._tag === "path" && shape.pathLength === 1
        ),
        name
      ).toBe(true);
    }
  });
});
