import { describe, expect, it } from "@effect/vitest";
import { Drawing } from "@repo/design-system/components/ui/drawing";
import { attributeName, attributesOf } from "@repo/design-system/lib/attribute";
import {
  circle,
  ellipse,
  group,
  path,
  polygon,
  rect,
  type Shape,
} from "@repo/mascot/shape";
import { Array as Arr, Option, Order, Record as Rec } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const PAINT = {
  fill: "red",
  fillOpacity: 0.5,
  fillRule: "evenodd",
  opacity: 0.5,
  stroke: "blue",
  strokeDasharray: "1 2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeOpacity: 0.5,
  strokeWidth: 2,
  transform: "rotate(5)",
} as const;

/** One shape of each kind, each with every field it can set. */
const EVERY_FIELD: readonly Shape[] = [
  path({ ...PAINT, d: "M0,0 L1,1", pathLength: 1 }),
  ellipse({ ...PAINT, cx: 1, cy: 2, rx: 3, ry: 4 }),
  circle({ ...PAINT, cx: 1, cy: 2, r: 3 }),
  rect({ ...PAINT, height: 4, rx: 1, width: 3, x: 1, y: 2 }),
  polygon({ ...PAINT, points: "0,0 1,1 2,0" }),
  group([], PAINT),
];

/** The attributes of the element that React draws for a shape, in order of name. */
function drawnNames(shape: Shape) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    createElement(
      "svg",
      null,
      createElement(Drawing<never>, { marked: () => ({}), shape })
    )
  );
  return Arr.sort(
    Option.match(Option.fromNullishOr(host.querySelector(shape._tag)), {
      onNone: () => [],
      onSome: (element) => element.getAttributeNames(),
    }),
    Order.String
  );
}

describe("what a shape sets on its element", () => {
  it("is every field of the shape but its tag, its mark and the shapes it holds", () => {
    expect(attributesOf(path({ d: "M0,0", fill: "red", mark: "eye" }))).toEqual(
      { d: "M0,0", fill: "red" }
    );
    expect(
      attributesOf(
        group([circle({ cx: 1, cy: 1, r: 1 })], { opacity: 0.5, mark: "eye" })
      )
    ).toEqual({ opacity: 0.5 });
  });

  it("is named as the DOM names it: with a dash, unless the DOM keeps the capitals", () => {
    expect(attributeName("strokeWidth")).toBe("stroke-width");
    expect(attributeName("fillOpacity")).toBe("fill-opacity");
    expect(attributeName("pathLength")).toBe("pathLength");
    expect(attributeName("d")).toBe("d");
    expect(attributeName("cx")).toBe("cx");
  });

  it("is named the same by React, which draws the shapes, for every field that a shape has", () => {
    for (const shape of EVERY_FIELD) {
      expect(drawnNames(shape), shape._tag).toEqual(
        Arr.sort(
          Arr.map(Rec.keys(attributesOf(shape)), attributeName),
          Order.String
        )
      );
    }
  });
});
