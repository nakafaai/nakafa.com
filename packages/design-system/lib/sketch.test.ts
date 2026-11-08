import { describe, expect, it } from "@effect/vitest";
import { loadP5, SketchLoadError } from "@repo/design-system/lib/sketch";
import { Effect, Exit } from "effect";

describe("loadP5", () => {
  it.effect("fails with a typed error when a chunk does not load", () =>
    Effect.gen(function* () {
      vi.doMock("p5/math", () => {
        throw new Error("offline");
      });
      const exit = yield* Effect.exit(loadP5());
      vi.doUnmock("p5/math");

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(SketchLoadError.name);
      }
    })
  );

  it.effect("loads the core with its shape, color, and math addons once", () =>
    Effect.gen(function* () {
      const P5 = yield* loadP5();
      const again = yield* loadP5();

      expect(again).toBe(P5);
      for (const method of ["ellipse", "fill", "lerp", "loop", "noLoop"]) {
        expect(method in P5.prototype).toBe(true);
      }
    })
  );
});
