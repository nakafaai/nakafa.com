import { afterEach, describe, expect, it } from "@effect/vitest";
import { GuardianFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  guardianMode,
  seedGuardian,
} from "@repo/backend/scripts/content/acceptance/guardian";
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

const ANSWER = { code: "123456" };

describe("acceptance guardian", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds through guardians/seed:code and answers what it returned",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({ "guardians/seed:code": ANSWER });

        const seeded = yield* seedGuardian(
          "acc-1",
          "wali@example.test",
          "0012345678"
        ).pipe(Effect.provide(backend.layer));

        expect(seeded).toEqual(ANSWER);
        expect(backend.argsOf("guardians/seed:code")).toEqual({
          email: "wali@example.test",
          nisn: "0012345678",
          slug: "acc-1",
        });
      })
  );

  it.effect("writes what the mode seeded to the file it names, mode 600", () =>
    Effect.gen(function* () {
      const root = yield* folder;
      const output = `${root}/mode.json`;
      mocks.layer.mockReturnValue(
        localConvexDouble({ "guardians/seed:code": ANSWER }).layer
      );

      yield* guardianMode.run(root, [
        "acc-1",
        "wali@example.test",
        "0012345678",
        output,
      ]);

      const fs = yield* FileSystem.FileSystem;
      expect(
        yield* fs
          .readFileString(output)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(GuardianFixture))
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
        yield* guardianMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message:
          "Usage: acceptance guardian <school-slug> <email> <nisn> <code-file>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
