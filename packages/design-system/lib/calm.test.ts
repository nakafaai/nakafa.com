import { describe, expect, it } from "@effect/vitest";
import { isCalm } from "@repo/design-system/lib/calm";
import { MutableList } from "effect";

describe("a person who asked for less motion", () => {
  it("is known by asking the system about reduced motion", () => {
    const asked = MutableList.make<string>();
    for (const matches of [true, false]) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: (query: string) => {
          MutableList.append(asked, query);
          return { matches };
        },
      });
      expect(isCalm()).toBe(matches);
    }
    expect(MutableList.toArray(asked)).toEqual([
      "(prefers-reduced-motion: reduce)",
      "(prefers-reduced-motion: reduce)",
    ]);
  });
});
