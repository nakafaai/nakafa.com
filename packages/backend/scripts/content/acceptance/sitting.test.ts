import { afterEach, describe, expect, it } from "@effect/vitest";
import { SittingFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  seedSitting,
  sittingMode,
} from "@repo/backend/scripts/content/acceptance/sitting";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";

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

const SITTING = {
  examId: "exam-1",
  sittingId: "sitting-1",
  title: "Ujian Fisika",
  token: "ABC123",
};
const SEED = "exams/seed:sitting";

describe("acceptance sitting", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds a sitting for the learner, with no crowd and no extra unless asked",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({ [SEED]: SITTING });

        const plain = yield* seedSitting("acc-1", "siswa@example.test").pipe(
          Effect.provide(backend.layer)
        );
        yield* seedSitting("acc-1", "siswa@example.test", 3, "essay").pipe(
          Effect.provide(backend.layer)
        );

        expect(plain).toEqual(SITTING);
        expect(Arr.map(backend.calls(), (one) => one.call.args)).toEqual([
          { email: "siswa@example.test", slug: "acc-1" },
          { crowd: 3, email: "siswa@example.test", essay: true, slug: "acc-1" },
        ]);
      })
  );

  it.effect(
    "writes the sitting the mode names, with its crowd and extra, to the file it names",
    () =>
      Effect.gen(function* () {
        const root = yield* folder;
        const output = `${root}/sitting.json`;
        const backend = localConvexDouble({ [SEED]: SITTING });
        mocks.layer.mockReturnValue(backend.layer);

        yield* sittingMode.run(root, [
          "acc-1",
          "siswa@example.test",
          output,
          "2",
          "upcoming",
        ]);

        expect(backend.argsOf(SEED)).toEqual({
          crowd: 2,
          email: "siswa@example.test",
          slug: "acc-1",
          upcoming: true,
        });
        const fs = yield* FileSystem.FileSystem;
        expect(
          yield* fs
            .readFileString(output)
            .pipe(
              Effect.flatMap(
                Schema.decodeEffect(Schema.fromJsonString(SittingFixture))
              )
            )
        ).toEqual(SITTING);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses an extra the sitting mode does not know", () =>
    Effect.gen(function* () {
      expect(
        yield* sittingMode
          .run("/root", ["acc-1", "siswa@example.test", "/out", "0", "later"])
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
