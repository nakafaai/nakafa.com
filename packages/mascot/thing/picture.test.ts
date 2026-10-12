import { describe, expect, it } from "@effect/vitest";
import type { Shape } from "@repo/mascot/shape";
import type { Mark } from "@repo/mascot/thing/mark";
import { ThingNameSchema } from "@repo/mascot/thing/name";
import { PICTURES } from "@repo/mascot/thing/picture";
import { Array as Arr } from "effect";

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

  it("measure a line that draws itself as one unit long, for the dash that hides it to fit", () => {
    const drawing = Arr.filter(
      Arr.flatMap(ThingNameSchema.literals, (name) =>
        allShapes(PICTURES[name])
      ),
      (shape) => shape.mark?.motion === "draw"
    );
    expect(Arr.length(drawing)).toBeGreaterThan(0);
    expect(
      Arr.every(
        drawing,
        (shape) => shape._tag === "path" && shape.pathLength === 1
      )
    ).toBe(true);
  });
});
