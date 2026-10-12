import { describe, expect, it } from "@effect/vitest";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";

/**
 * The seven sections of a UTBK-SNBT set are the longest list of tiles that the
 * product shows at once. The home trending list shows six lessons.
 */
const LONGEST_LIST = 7;

describe("SPARE_ICONS", () => {
  it("holds more icons than the longest list of tiles that the product shows", () => {
    expect(SPARE_ICONS.length).toBeGreaterThan(LONGEST_LIST);
  });
});
