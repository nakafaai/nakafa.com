import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa service", () => {
  it("fails fast without an injected runtime", async () => {
    await expectDefaultRuntimeFailure(Nakafa.exercise("en/exercises/example"));
    await expectDefaultRuntimeFailure(Nakafa.quran({ surah: 1 }));
    await expectDefaultRuntimeFailure(Nakafa.read("en/articles/example"));
    await expectDefaultRuntimeFailure(Nakafa.taxonomy("en"));
    await expectDefaultRuntimeFailure(Nakafa.verify("en/articles/example"));
  });
});

/** Verifies one Nakafa accessor fails when only the fail-fast default is present. */
async function expectDefaultRuntimeFailure(
  effect: Effect.Effect<unknown, unknown, Nakafa>
) {
  const exit = await Effect.runPromiseExit(
    effect.pipe(Effect.provide(Nakafa.Default))
  );

  expect(Exit.isFailure(exit)).toBe(true);
}
