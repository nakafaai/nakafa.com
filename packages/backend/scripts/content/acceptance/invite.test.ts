import { afterEach, describe, expect, it } from "@effect/vitest";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  inviteMode,
  seedInvite,
  waitForInboxRow,
} from "@repo/backend/scripts/content/acceptance/invite";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  Duration,
  Effect,
  Exit,
  FileSystem,
  Layer,
  MutableList,
  Option,
  Schema,
} from "effect";

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

const SLUG = "acc-1a2b3c4d";
const ADDRESS = "learner-1a2b3c4d@acceptance.example.test";
const INVITED = { invite: "invite-1", person: "person-1" };

/** What the local backend answers an invite: its ids, a new account and its app user, and the inbox row. */
const ANSWERS = {
  "adapter:create": { _creationTime: 1, _id: "user-1" },
  "tenancy/provision:invite": INVITED,
  "tenancy/seed:invitation": true,
  "tenancy/seed:user": "app-user-1",
};

describe("acceptance invite", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "invites the address, claims it for the learner's account, and answers once the inbox holds the row",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble(ANSWERS);

        const cookie = yield* seedInvite(SLUG, ADDRESS).pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        expect(backend.argsOf("tenancy/provision:invite")).toEqual({
          email: ADDRESS,
          locale: "id",
          name: "Acceptance Learner",
          slug: SLUG,
        });
        expect(backend.argsOf("tenancy/claims:run")).toEqual({
          cursor: null,
          userId: "app-user-1",
        });
        expect(backend.argsOf("tenancy/seed:invitation")).toEqual(INVITED);
        expect(backend.paths()).not.toContain("tenancy/seed:expired");
        expect(cookie.name).toBe("better-auth.session_token");
      })
  );

  it.effect(
    "ends an expired invite before the account signs in, and waits for no inbox row",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble({
          ...ANSWERS,
          "tenancy/seed:invitation": false,
        });

        yield* seedInvite(SLUG, ADDRESS, true).pipe(
          Effect.provide(Layer.merge(backend.layer, nodePlatform))
        );

        const paths = backend.paths();
        const at = (path: string) =>
          Option.getOrThrow(Arr.findFirstIndex(paths, (one) => one === path));
        expect(at("tenancy/seed:expired")).toBeLessThan(at("adapter:create"));
        expect(backend.argsOf("tenancy/seed:expired")).toEqual({
          email: ADDRESS,
          slug: SLUG,
        });
        expect(paths).not.toContain("tenancy/seed:invitation");
      })
  );

  it.live(
    "reads the one inbox row of the invite and its Person until it stands",
    () =>
      Effect.gen(function* () {
        const asked = MutableList.make<unknown>();
        // The row stands from the third read on.
        yield* waitForInboxRow(
          (_operation, call) =>
            Effect.sync(() => {
              MutableList.append(asked, call.args);
              return asked.length >= 3;
            }),
          INVITED,
          Duration.seconds(5)
        );

        expect(MutableList.toArray(asked)).toEqual([INVITED, INVITED, INVITED]);
      })
  );

  it.live("fails when the inbox does not hold the row in time", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        waitForInboxRow(
          () => Effect.succeed(false),
          INVITED,
          Duration.millis(1)
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect(
    "writes the invited learner's cookie to the file the mode names",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-invite-test-",
        });
        const backend = localConvexDouble(ANSWERS);
        mocks.layer.mockReturnValue(backend.layer);

        yield* inviteMode.run(root, [
          SLUG,
          ADDRESS,
          `${root}/cookie.json`,
          "expired",
        ]);

        const cookie = yield* fs
          .readFileString(`${root}/cookie.json`)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(SessionCookie))
            )
          );
        expect(cookie.name).toBe("better-auth.session_token");
        expect(backend.paths()).toContain("tenancy/seed:expired");
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses an invite mode whose fourth argument is not expired", () =>
    Effect.gen(function* () {
      expect(
        yield* inviteMode
          .run("/root", [SLUG, ADDRESS, "/cookie.json", "later"])
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
