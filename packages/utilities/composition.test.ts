import { describe, expect, it } from "@effect/vitest";
import { isComposingKey } from "@repo/utilities/composition";

describe("composition", () => {
  it("treats a key pressed while an input method composes as its own", () => {
    expect(isComposingKey({ isComposing: true, keyCode: 13 })).toBe(true);
  });

  it("treats the key that closes a composition after compositionend as its own", () => {
    expect(isComposingKey({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it("leaves an ordinary Enter to the page", () => {
    expect(isComposingKey({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it("leaves an ordinary letter to the page", () => {
    expect(isComposingKey({ isComposing: false, keyCode: 65 })).toBe(false);
  });
});
