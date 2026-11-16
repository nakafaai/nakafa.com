import { describe, expect, it } from "@effect/vitest";
import { MISSING, placed, WAITING } from "@repo/design-system/lib/toy/scatter";
import { within } from "@/components/marketing/about/toys/place";

/** The box the layer measures for the part: 400 by 200, starting at 100, 100. */
const box = () => ({
  bottom: 300,
  height: 200,
  left: 100,
  right: 500,
  top: 100,
  width: 400,
});

/** A part of the page with an id, which lives only for one test, holding `inside` when it is given. */
function part(id: string, inside?: Element) {
  const element = document.createElement("section");
  element.id = id;
  if (inside !== undefined) {
    element.append(inside);
  }
  document.body.append(element);
  return () => element.remove();
}

/** What a part holds, whose drawing the browser skips or not, as `checkVisibility` answers. */
function content(drawn: boolean) {
  const element = document.createElement("div");
  Object.defineProperty(element, "checkVisibility", {
    value: (options: CheckVisibilityOptions) =>
      drawn || options.contentVisibilityAuto !== true,
  });
  return element;
}

describe("toy places beside a part", () => {
  it("puts a toy at a fraction of its part, moved by its pixels", () => {
    const remove = part("place-fraction");
    const place = within("place-fraction", { dx: 4, dy: -8, x: 0.5, y: 0.25 });

    expect(place(1024, box)).toEqual(
      placed({ x: 100 + 0.5 * 400 + 4, y: 100 + 0.25 * 200 - 8 })
    );
    remove();
  });

  it("leaves a toy out of a width it is not for", () => {
    const remove = part("place-width");
    const phoneOnly = within("place-width", { maxWidth: 767, x: 0, y: 0 });
    const desktopOnly = within("place-width", { minWidth: 1024, x: 0, y: 0 });

    expect(phoneOnly(1024, box)).toEqual(MISSING);
    expect(desktopOnly(390, box)).toEqual(MISSING);
    expect(phoneOnly(390, box)).toEqual(placed({ x: 100, y: 100 }));
    remove();
  });

  it("leaves a toy out when its part is not on the page", () => {
    const place = within("place-missing", { x: 0, y: 0 });

    expect(place(1024, box)).toEqual(MISSING);
  });

  it("waits while the browser skips drawing its part, and places it once the part is drawn", () => {
    const skippedRemove = part("place-skipped", content(false));
    const drawnRemove = part("place-drawn", content(true));

    expect(within("place-skipped", { x: 0, y: 0 })(1024, box)).toEqual(WAITING);
    expect(within("place-drawn", { x: 0, y: 0 })(1024, box)).toEqual(
      placed({ x: 100, y: 100 })
    );
    skippedRemove();
    drawnRemove();
  });

  it("leaves a toy out while its part is not drawn, as a part hidden on a phone", () => {
    const remove = part("place-hidden");
    const place = within("place-hidden", { x: 0, y: 0 });
    const noBox = () => ({ ...box(), height: 0, width: 0 });

    expect(place(390, noBox)).toEqual(MISSING);
    remove();
  });
});
