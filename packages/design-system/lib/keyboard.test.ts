import { describe, expect, it } from "@effect/vitest";
import {
  isEnterOutsideComposition,
  isOutsideComposition,
} from "@repo/design-system/lib/keyboard";

describe("keyboard", () => {
  it("reads a key press the learner makes outside a composed character, whatever the key", () => {
    expect(isOutsideComposition({ isComposing: false, keyCode: 27 })).toBe(
      true
    );
  });

  it("does not read a key press that a composition runs, whatever the key", () => {
    expect(isOutsideComposition({ isComposing: true, keyCode: 27 })).toBe(
      false
    );
  });

  it("does not read the key press that Safari sends after a composed character has ended", () => {
    expect(isOutsideComposition({ isComposing: false, keyCode: 229 })).toBe(
      false
    );
  });

  it("reads an Enter that the learner sends outside a composed character", () => {
    expect(
      isEnterOutsideComposition({
        isComposing: false,
        key: "Enter",
        keyCode: 13,
      })
    ).toBe(true);
  });

  it("does not read the Enter that confirms a composed character while it runs", () => {
    expect(
      isEnterOutsideComposition({
        isComposing: true,
        key: "Enter",
        keyCode: 229,
      })
    ).toBe(false);
  });

  it("does not read an Enter that arrives while a composition runs, whatever its key code", () => {
    expect(
      isEnterOutsideComposition({
        isComposing: true,
        key: "Enter",
        keyCode: 13,
      })
    ).toBe(false);
  });

  it("does not read the Enter that Safari sends after a composed character has ended", () => {
    expect(
      isEnterOutsideComposition({
        isComposing: false,
        key: "Enter",
        keyCode: 229,
      })
    ).toBe(false);
  });

  it("does not read a key that is not Enter", () => {
    expect(
      isEnterOutsideComposition({ isComposing: false, key: "a", keyCode: 65 })
    ).toBe(false);
  });
});
