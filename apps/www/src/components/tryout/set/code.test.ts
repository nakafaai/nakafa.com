import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { openSetSamples, samplesCode } from "@/components/tryout/set/code";
import { TryoutSetSamples } from "@/components/tryout/set/samples";

describe("openSetSamples", () => {
  it("loads the samples' code and keeps it, so the set's boundary draws them at once", async () => {
    expect(Option.isNone(samplesCode.component)).toBe(true);
    await expect(openSetSamples()).resolves.toBe(TryoutSetSamples);
    expect(samplesCode.component).toEqual(Option.some(TryoutSetSamples));
  });
});
