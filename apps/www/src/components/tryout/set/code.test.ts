import { describe, expect, it } from "@effect/vitest";
import { Function as Fn, Option } from "effect";
import { openSetSamples, samplesCode } from "@/components/tryout/set/code";
import { TryoutSetSamples } from "@/components/tryout/set/samples";

// The samples' component stands in for its code: the real one loads the question's parts, which a browser run
// proves, and whose plain modules a unit run would load without calling.
vi.mock("@/components/tryout/set/samples", () => ({
  TryoutSetSamples: Fn.constNull,
}));

describe("openSetSamples", () => {
  it("loads the samples' code and keeps it, so the set's boundary draws them at once", async () => {
    expect(Option.isNone(samplesCode.component)).toBe(true);
    await expect(openSetSamples()).resolves.toBe(TryoutSetSamples);
    expect(samplesCode.component).toEqual(Option.some(TryoutSetSamples));
  });
});
