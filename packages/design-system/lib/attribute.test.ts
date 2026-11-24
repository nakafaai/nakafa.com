import { describe, expect, it } from "@effect/vitest";
import { Drawing } from "@repo/design-system/components/ui/drawing";
import { attributesOf } from "@repo/design-system/lib/attribute";
import type { Shape } from "@repo/mascot/shape";
import {
  circle,
  ellipse,
  group,
  path,
  polygon,
  rect,
} from "@repo/mascot/shape";
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
const EVERY_FIELD: readonly Shape<"eye">[] = [
  path({ ...PAINT, d: "M0,0 L1,1", pathLength: 1 }),
  ellipse({ ...PAINT, cx: 1, cy: 2, rx: 3, ry: 4 }),
  circle({ ...PAINT, cx: 1, cy: 2, r: 3 }),
  rect({ ...PAINT, height: 4, rx: 1, width: 3, x: 1, y: 2 }),
  polygon({ ...PAINT, points: "0,0 1,1 2,0" }),
  group([circle({ cx: 1, cy: 1, mark: "eye", r: 1 })], PAINT),
];

describe("what a shape sets on its element", () => {
  it("is every field of the shape but its tag, its mark and the shapes it holds", () => {
    expect(attributesOf(path({ d: "M0,0", fill: "red", mark: "eye" }))).toEqual(
      { d: "M0,0", fill: "red" }
    );
    expect(
      attributesOf(
        group([circle({ cx: 1, cy: 1, r: 1 })], { mark: "eye", opacity: 0.5 })
      )
    ).toEqual({ opacity: 0.5 });
  });

  it("renders every shape kind, nested children and marks through Drawing", () => {
    for (const shape of EVERY_FIELD) {
      const markup = renderToStaticMarkup(
        createElement(
          "svg",
          null,
          createElement(Drawing<"eye">, {
            marked: () => ({ "data-eye": "true" }),
            shape,
          })
        )
      );
      expect(markup).toContain(`<${shape._tag}`);
      if (shape._tag === "g") {
        expect(markup).toContain('data-eye="true"');
      }
    }
  });
});
