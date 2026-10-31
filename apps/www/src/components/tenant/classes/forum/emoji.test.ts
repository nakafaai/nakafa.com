import { describe, expect, it } from "@effect/vitest";
import { Emoji } from "@repo/backend/confect/classroom/forum/tally";
import { Array as Arr, Schema } from "effect";
import { EMOJI, QUICK_EMOJI } from "@/components/tenant/classes/forum/emoji";

describe("the chat's emoji", () => {
  it("offers only what the server keeps, each once", () => {
    const offered = Arr.appendAll(EMOJI, QUICK_EMOJI);
    expect(Arr.filter(offered, (emoji) => !Schema.is(Emoji)(emoji))).toEqual(
      []
    );
    expect(Arr.dedupe(EMOJI)).toEqual(EMOJI);
  });
});
