import { afterEach, describe, expect, it } from "@effect/vitest";
import { GraduationFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  graduationMode,
  seedGraduation,
} from "@repo/backend/scripts/content/acceptance/graduation";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem, Schema } from "effect";

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

/** A temporary folder for the files a mode writes. */
const folder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "acceptance-mode-test-" });
});

const ANSWER = { cohort: "XII-1", cohortId: "cohort-1" };

describe("acceptance graduation", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds through records/seed:graduation and answers what it returned",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({
          "records/seed:graduation": ANSWER,
        });

        const seeded = yield* seedGraduation(
          "acc-1",
          "siswa@example.test"
        ).pipe(Effect.provide(backend.layer));

        expect(seeded).toEqual(ANSWER);
        expect(backend.argsOf("records/seed:graduation")).toEqual({
          email: "siswa@example.test",
          slug: "acc-1",
        });
      })
  );

  it.effect("writes what the mode seeded to the file it names, mode 600", () =>
    Effect.gen(function* () {
      const root = yield* folder;
      const output = `${root}/mode.json`;
      mocks.layer.mockReturnValue(
        localConvexDouble({ "records/seed:graduation": ANSWER }).layer
      );

      yield* graduationMode.run(root, ["acc-1", "siswa@example.test", output]);

      const fs = yield* FileSystem.FileSystem;
      expect(
        yield* fs
          .readFileString(output)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(GraduationFixture))
            )
          )
      ).toEqual(ANSWER);
      expect((yield* fs.stat(output)).mode % 0o1000).toBe(0o600);
      expect(mocks.layer).toHaveBeenCalledWith(root);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its arguments", () =>
    Effect.gen(function* () {
      expect(
        yield* graduationMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message:
          "Usage: acceptance graduation <school-slug> <learner-email> <graduation-file>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
