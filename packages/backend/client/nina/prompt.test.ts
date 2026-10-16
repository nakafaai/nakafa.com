import { describe, expect, it } from "@effect/vitest";
import {
  isPromptWithinLimit,
  NINA_PROMPT_LENGTH,
} from "@repo/backend/client/nina/prompt";
import { Array as Arr } from "effect";

describe("the prompt limit", () => {
  it("takes a prompt of exactly the limit and refuses one character more", () => {
    expect(isPromptWithinLimit("a".repeat(NINA_PROMPT_LENGTH))).toBe(true);
    expect(isPromptWithinLimit("a".repeat(NINA_PROMPT_LENGTH + 1))).toBe(false);
  });

  it("counts a character of two UTF-16 units once", () => {
    const emoji = "\u{1F600}";

    expect(emoji).toHaveLength(2);
    expect(isPromptWithinLimit(emoji.repeat(NINA_PROMPT_LENGTH))).toBe(true);
    expect(isPromptWithinLimit(emoji.repeat(NINA_PROMPT_LENGTH + 1))).toBe(
      false
    );
  });

  it("counts a sequence once for each code point in it, not once for what a reader sees as one", () => {
    // A family emoji is one character to a reader: a man, a woman and a girl
    // joined by two zero width joiners (U+200D), which is five code points.
    const family = String.fromCodePoint(
      0x1_f4_68,
      0x20_0d,
      0x1_f4_69,
      0x20_0d,
      0x1_f4_67
    );
    const codePoints = Arr.fromIterable(family).length;
    const fits = Math.floor(NINA_PROMPT_LENGTH / codePoints);

    expect(codePoints).toBe(5);
    expect(isPromptWithinLimit(family.repeat(fits))).toBe(true);
    expect(isPromptWithinLimit(family.repeat(fits + 1))).toBe(false);
  });
});
