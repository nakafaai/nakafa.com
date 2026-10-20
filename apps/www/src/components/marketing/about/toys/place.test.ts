import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
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

/** A part of the page with an id, which lives only for one test. */
function part(id: string) {
  const element = document.createElement("section");
  element.id = id;
  document.body.append(element);
  return () => element.remove();
}

describe("toy places beside a part", () => {
  it("puts a toy at a fraction of its part, moved by its pixels", () => {
    const remove = part("place-fraction");
    const place = within("place-fraction", { dx: 4, dy: -8, x: 0.5, y: 0.25 });

    expect(Option.getOrNull(place(1024, box))).toEqual({
      x: 100 + 0.5 * 400 + 4,
      y: 100 + 0.25 * 200 - 8,
    });
    remove();
  });

  it("leaves a toy out of a width it is not for", () => {
    const remove = part("place-width");
    const phoneOnly = within("place-width", { maxWidth: 767, x: 0, y: 0 });
    const desktopOnly = within("place-width", { minWidth: 1024, x: 0, y: 0 });

    expect(Option.isNone(phoneOnly(1024, box))).toBe(true);
    expect(Option.isNone(desktopOnly(390, box))).toBe(true);
    expect(Option.isSome(phoneOnly(390, box))).toBe(true);
    remove();
  });

  it("leaves a toy out when its part is not on the page", () => {
    const place = within("place-missing", { x: 0, y: 0 });

    expect(Option.isNone(place(1024, box))).toBe(true);
  });

  it("leaves a toy out while its part is not drawn, as a part hidden on a phone", () => {
    const remove = part("place-hidden");
    const place = within("place-hidden", { x: 0, y: 0 });
    const noBox = () => ({ ...box(), height: 0, width: 0 });

    expect(Option.isNone(place(390, noBox))).toBe(true);
    remove();
  });
});
