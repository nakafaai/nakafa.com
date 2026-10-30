import { afterEach, describe, expect, it } from "@effect/vitest";
import { elementById } from "@repo/design-system/lib/element";

afterEach(() => {
  document.body.replaceChildren();
});

describe("elementById", () => {
  it("finds the element of an id that a selector could not name without escaping", () => {
    document.body.innerHTML =
      '<h2 id="1-limits">Limits</h2><div id="«r0»:menu">Menu</div>';

    expect(elementById("1-limits")?.textContent).toBe("Limits");
    expect(elementById("«r0»:menu")?.textContent).toBe("Menu");
  });

  it("answers null for an id that no HTML element holds", () => {
    document.body.innerHTML =
      '<svg><circle id="dot"></circle></svg><p id="kept">Kept</p>';

    expect(elementById("missing")).toBeNull();
    expect(elementById("dot")).toBeNull();
  });
});
