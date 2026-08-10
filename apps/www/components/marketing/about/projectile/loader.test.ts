// @vitest-environment node

import { Duration, Effect, Fiber, TestClock, TestContext } from "effect";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadProjectileScene } from "@/components/marketing/about/projectile/loader";

const runWithTestClock = <Value, Error>(program: Effect.Effect<Value, Error>) =>
  Effect.runPromise(program.pipe(Effect.provide(TestContext.TestContext)));

describe("deferred projectile scene loading", () => {
  it("retries transient import failures with the bounded schedule", async () => {
    const importFailure = new Error("chunk unavailable");
    const Scene = () => createElement("div");
    let attempts = 0;
    const loadScene = vi.fn(() => {
      attempts += 1;

      if (attempts < 4) {
        return Promise.reject(importFailure);
      }

      return Promise.resolve(Scene);
    });
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(loadProjectileScene(loadScene));
      yield* TestClock.adjust(Duration.seconds(4));

      return yield* Fiber.join(fiber);
    });

    await expect(runWithTestClock(program)).resolves.toBe(Scene);
    expect(loadScene).toHaveBeenCalledTimes(4);
  });

  it("preserves the typed terminal failure after bounded retries", async () => {
    const importFailure = new Error("chunk unavailable");
    const loadScene = vi.fn(() => Promise.reject(importFailure));
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        loadProjectileScene(loadScene).pipe(Effect.flip)
      );
      yield* TestClock.adjust(Duration.seconds(4));

      return yield* Fiber.join(fiber);
    });

    await expect(runWithTestClock(program)).resolves.toMatchObject({
      _tag: "ProjectileSceneLoadError",
      cause: importFailure,
      message: "Failed to load the projectile lesson scene.",
    });
    expect(loadScene).toHaveBeenCalledTimes(4);
  });
});
