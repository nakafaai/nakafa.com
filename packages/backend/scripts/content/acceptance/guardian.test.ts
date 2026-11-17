import { afterEach, describe, expect, it } from "@effect/vitest";
import { SessionCookies } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  guardianMode,
  seedGuardian,
} from "@repo/backend/scripts/content/acceptance/guardian";
import {
  localConvexDouble,
  PASSWORD_SIGN_IN,
  SESSION_COOKIES,
  SIGN_IN_ANSWERS,
} from "@repo/backend/test/acceptance";
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

const SEED = "guardians/seed:account";
/** What the backend answers: the seeded parent's account and password, and its sign-in. */
const ANSWERS = {
  ...SIGN_IN_ANSWERS,
  [SEED]: { password: "guardian-password", userId: "guardian-1" },
};

describe("acceptance guardian", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds the parent's account and signs it in with the password the seed answers",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(ANSWERS);
        const cookies = yield* seedGuardian(
          "acc-1",
          "wali@example.test",
          "0012345678"
        ).pipe(Effect.provide(backend.layer));
        expect(cookies).toEqual(SESSION_COOKIES);
        expect(backend.paths()).toEqual([SEED, PASSWORD_SIGN_IN]);
        expect(backend.argsOf(SEED)).toEqual({
          email: "wali@example.test",
          nisn: "0012345678",
          slug: "acc-1",
        });
        expect(backend.argsOf(PASSWORD_SIGN_IN)).toEqual({
          password: "guardian-password",
          username: "guardian-1",
        });
      })
  );

  it.effect("refuses a seed that answers no account", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble({ ...ANSWERS, [SEED]: null });
      expect(
        yield* seedGuardian("acc-1", "wali@example.test", "0012345678").pipe(
          Effect.provide(backend.layer),
          Effect.flip
        )
      ).toMatchObject({ _tag: "SchemaError" });
      expect(backend.paths()).toEqual([SEED]);
    })
  );

  it.effect("writes the parent's cookies to the file it names, mode 600", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-guardian-test-",
      });
      const output = `${root}/cookies.json`;
      mocks.layer.mockReturnValue(localConvexDouble(ANSWERS).layer);
      yield* guardianMode.run(root, [
        "acc-1",
        "wali@example.test",
        "0012345678",
        output,
      ]);
      expect(
        yield* fs
          .readFileString(output)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(SessionCookies))
            )
          )
      ).toEqual(SESSION_COOKIES);
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
          "Usage: acceptance guardian <school-slug> <email> <nisn> <cookie-file>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
