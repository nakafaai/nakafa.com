import { describe, expect, it } from "@effect/vitest";
import { readSetSections } from "@/components/tryout/set/sections";

const verbal = { timeLimitSeconds: 1800, visibility: "visible" } as const;
const numeric = { timeLimitSeconds: 2400, visibility: "visible" } as const;
const whole = { timeLimitSeconds: 3600, visibility: "internal-entry" } as const;

describe("readSetSections", () => {
  it("gives a set entered directly its one entry section, which its page does not list", () => {
    expect(readSetSections({ entrySection: whole, sections: [] })).toEqual([
      whole,
    ]);
  });

  it("gives a set with visible sections those sections, its entry being the first of them", () => {
    expect(
      readSetSections({ entrySection: verbal, sections: [verbal, numeric] })
    ).toEqual([verbal, numeric]);
  });
});
