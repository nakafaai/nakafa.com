import { describe, expect, it } from "@effect/vitest";
import { marked } from "@repo/design-system/components/nina/mark";
import { paint, sameFigure } from "@repo/design-system/components/nina/paint";
import { Picture } from "@repo/design-system/components/ui/picture";
import { scene } from "@repo/mascot/nina/figure";
import { limbOf, type Mark } from "@repo/mascot/nina/mark";
import type { Options } from "@repo/mascot/nina/options";
import { circle, group, path } from "@repo/mascot/shape";
import { Array as Arr, Option, Order } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Draws a picture as a page that sizes it with its styles does, and answers the
 * svg element that holds it. The picture has no name, so a screen reader skips it.
 */
function draw(
  shapes: ReturnType<typeof scene>["shapes"],
  box: readonly [number, number, number, number] = [0, 0, 200, 200]
) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    createElement(Picture<Mark>, { box, marked, shapes })
  );
  return Option.getOrThrow(Option.fromNullishOr(host.firstElementChild));
}

/** An element and everything in it, with its attributes in order of name. */
function canon(element: Element): string {
  const attributes = Arr.map(
    Arr.sort(Arr.fromIterable(element.getAttributeNames()), Order.String),
    (name) => ` ${name}="${element.getAttribute(name)}"`
  );
  return `<${element.localName}${Arr.join(attributes, "")}>${Arr.join(
    Arr.map(Arr.fromIterable(element.children), canon),
    ""
  )}</${element.localName}>`;
}

/**
 * Moves a drawn picture from one frame to the next, and whether what is drawn
 * is what a fresh drawing of the next frame would be. The two frames must be
 * the same figure, as they are when her life paints them.
 */
function moves(from: Options, to: Options) {
  const before = scene(from);
  const after = scene(to);
  const svg = draw(before.shapes, before.box);
  paint(svg, before.shapes, after.shapes);
  return (
    sameFigure(before.shapes, after.shapes) &&
    canon(svg) === canon(draw(after.shapes, after.box))
  );
}

describe("two pictures of the same figure", () => {
  it("are the same figure when she is in the same act and has the same face, at another moment", () => {
    const before = scene({ act: "relaxed", t: 0.4, whole: true });
    const after = scene({ act: "relaxed", t: 1.1, whole: true });
    expect(sameFigure(before.shapes, after.shapes)).toBe(true);
  });

  it("are not the same figure when she does another act, or has another face", () => {
    const relaxed = scene({ act: "relaxed", whole: true });
    expect(
      sameFigure(relaxed.shapes, scene({ act: "reading", whole: true }).shapes)
    ).toBe(false);
    expect(
      sameFigure(
        relaxed.shapes,
        scene({ act: "relaxed", mood: "sad", whole: true }).shapes
      )
    ).toBe(false);
  });

  it("are not the same figure when a shape comes or goes, or is another kind, or is another limb", () => {
    const line = path({ d: "M0,0 L1,1" });
    const dot = circle({ cx: 1, cy: 1, r: 1 });
    expect(sameFigure([line], [line, dot])).toBe(false);
    expect(sameFigure([line], [dot])).toBe(false);
    expect(sameFigure([group([line])], [group([line, dot])])).toBe(false);
    expect(sameFigure([group([line])], [line])).toBe(false);
    expect(
      sameFigure(
        [path({ d: "M0,0", mark: limbOf("armL") })],
        [path({ d: "M0,0", mark: limbOf("armR") })]
      )
    ).toBe(false);
    expect(
      sameFigure(
        [path({ d: "M0,0", mark: limbOf("armL") })],
        [path({ d: "M5,5", mark: limbOf("armL") })]
      )
    ).toBe(true);
  });
});

describe("painting a frame onto the elements of the one before", () => {
  it("leaves the elements as if the frame had been drawn from the start, in each way she is shown", () => {
    const pairs: readonly (readonly [Options, Options])[] = [
      [
        { act: "relaxed", t: 0.4, whole: true },
        { act: "relaxed", t: 0.9, whole: true },
      ],
      [
        { act: "typing", side: "left", t: 0.2, whole: true },
        { act: "typing", side: "left", t: 0.25, whole: true },
      ],
      [
        { act: "reading", t: 0.5, look: [1, 1], whole: true },
        { act: "reading", t: 0.6, look: [-2, 1], whole: true },
      ],
      [
        { act: "cheering", t: 0.3, whole: true },
        { act: "cheering", t: 0.4, whole: true },
      ],
      [
        { act: "gripping", lean: "peek", t: 0.3 },
        { act: "gripping", lean: "peek", t: 1.2 },
      ],
      [
        { lean: "right", look: [0, 0], mood: "happy", tile: "cream" },
        { lean: "right", look: [3, -2], mood: "happy", tile: "cream" },
      ],
    ];
    for (const [from, to] of pairs) {
      expect(moves(from, to), `${from.act} to ${to.act}`).toBe(true);
    }
  });

  it("leaves the svg element that holds her as it is, with the name she was given", () => {
    const before = scene({ act: "relaxed", t: 0.4, whole: true });
    const after = scene({ act: "relaxed", t: 1.1, whole: true });
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      createElement(Picture<Mark>, {
        ...before,
        label: "Nina",
        marked,
        size: 100,
      })
    );
    const svg = Option.getOrThrow(Option.fromNullishOr(host.firstElementChild));
    const attributes = () =>
      Arr.map(svg.getAttributeNames(), (name) => [
        name,
        svg.getAttribute(name),
      ]);
    const held = attributes();
    paint(svg, before.shapes, after.shapes);
    expect(attributes()).toEqual(held);
    expect(svg.getAttribute("aria-label")).toBe("Nina");
    expect(svg.getAttribute("role")).toBe("img");
  });

  it("writes nothing when nothing changed", () => {
    const frame = scene({ act: "relaxed", t: 0.4, whole: true });
    const svg = draw(frame.shapes, frame.box);
    const writes = vi.spyOn(Element.prototype, "setAttribute");
    const takes = vi.spyOn(Element.prototype, "removeAttribute");
    paint(
      svg,
      frame.shapes,
      scene({ act: "relaxed", t: 0.4, whole: true }).shapes
    );
    expect(writes).not.toHaveBeenCalled();
    expect(takes).not.toHaveBeenCalled();
    writes.mockRestore();
    takes.mockRestore();
  });

  it("takes away an attribute that a shape no longer sets, and names attributes as the browser does", () => {
    const before = [
      path({ d: "M0,0 L1,1", opacity: 0.5, pathLength: 1, strokeWidth: 2 }),
    ];
    const after = [path({ d: "M0,0 L2,2", pathLength: 3, strokeWidth: 4 })];
    const svg = draw(before);
    paint(svg, before, after);
    const drawn = svg.firstElementChild;
    expect(drawn?.getAttribute("opacity")).toBeNull();
    expect(drawn?.getAttribute("d")).toBe("M0,0 L2,2");
    expect(drawn?.getAttribute("pathLength")).toBe("3");
    expect(drawn?.getAttribute("stroke-width")).toBe("4");
  });
});
