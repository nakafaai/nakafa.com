// @vitest-environment node

import { describe, expect, it } from "@repo/testing/effect";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { createElement } from "react";
import { vi } from "vitest";
import { loadProjectileScene } from "@/components/marketing/about/projectile/loader";

describe("deferred projectile scene loading", () => {
  it.effect("retries transient import failures with the bounded schedule", () =>
    Effect.gen(function* () {
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
      const fiber = yield* Effect.forkChild(loadProjectileScene(loadScene));
      yield* TestClock.adjust(Duration.seconds(4));
      expect(yield* Fiber.join(fiber)).toBe(Scene);
      expect(loadScene).toHaveBeenCalledTimes(4);
    })
  );

  it.effect("preserves the typed terminal failure after bounded retries", () =>
    Effect.gen(function* () {
      const importFailure = new Error("chunk unavailable");
      const loadScene = vi.fn(() => Promise.reject(importFailure));
      const fiber = yield* Effect.forkChild(
        loadProjectileScene(loadScene).pipe(Effect.flip)
      );
      yield* TestClock.adjust(Duration.seconds(4));
      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "ProjectileSceneLoadError",
        cause: importFailure,
        message: "Failed to load the projectile lesson scene.",
      });
      expect(loadScene).toHaveBeenCalledTimes(4);
    })
  );
});
