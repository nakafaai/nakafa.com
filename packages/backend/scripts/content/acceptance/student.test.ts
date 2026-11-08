import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  seedStudent,
  studentMode,
} from "@repo/backend/scripts/content/acceptance/student";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect } from "effect";

const mocks = vi.hoisted(() => ({ layer: vi.fn() }));
vi.mock(
  "@repo/backend/scripts/content/acceptance/convex",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/convex")
    >()),
    localConvexLayer: mocks.layer,
  })
);

describe("acceptance student", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "grants the learner of the address a student role in the school",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble();

        yield* seedStudent("acc-1", "siswa@example.test").pipe(
          Effect.provide(backend.layer)
        );

        expect(backend.paths()).toEqual(["tenancy/seed:student"]);
        expect(backend.argsOf("tenancy/seed:student")).toEqual({
          email: "siswa@example.test",
          slug: "acc-1",
        });
      })
  );

  it.effect("runs what the mode names against the runtime of the root", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble();
      mocks.layer.mockReturnValue(backend.layer);

      yield* studentMode.run("/root", [
        "acc-1",
        "siswa@example.test",
        "ignored",
      ]);

      expect(backend.argsOf("tenancy/seed:student")).toEqual({
        email: "siswa@example.test",
        slug: "acc-1",
      });
      expect(mocks.layer).toHaveBeenCalledWith("/root");
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its arguments", () =>
    Effect.gen(function* () {
      expect(
        yield* studentMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance student <school-slug> <learner-address>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
