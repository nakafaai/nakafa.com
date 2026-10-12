// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { ActSchema } from "@repo/design-system/components/nina/act";
import { EdgeSchema } from "@repo/design-system/components/nina/edge";
import { scene } from "@repo/design-system/components/nina/figure";
import {
  circle,
  group,
  ShapeSchema,
} from "@repo/design-system/components/nina/shape";
import { Array as Arr, Schema } from "effect";

const isShape = Schema.is(ShapeSchema);

describe("the shapes she is drawn from", () => {
  it("are all valid shapes, at every depth, for every act and every way she is shown", () => {
    const wholes = Arr.map(ActSchema.literals, (act) =>
      scene({ act, whole: true })
    );
    const edges = Arr.map(EdgeSchema.literals, (act) =>
      scene({ act, lean: "intip" })
    );
    const tile = scene({ lean: "kanan", tile: "pop-cream" });
    for (const { shapes } of [...wholes, ...edges, tile]) {
      expect(Arr.every(shapes, isShape)).toBe(true);
    }
  });

  it("reject a group with a shape that is not valid", () => {
    expect(isShape(group([circle({ cx: 1, cy: 2, r: 3 })], {}))).toBe(true);
    expect(isShape({ _tag: "g", children: [{ _tag: "circle", cx: 1 }] })).toBe(
      false
    );
  });
});
