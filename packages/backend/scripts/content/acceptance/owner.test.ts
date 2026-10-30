import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceOwner,
  ownerMode,
} from "@repo/backend/scripts/content/acceptance/owner";
import { ownerAddress } from "@repo/backend/scripts/content/acceptance/school";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  Effect,
  Exit,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

const SLUG = "acc-1a2b3c4d";
const CreatedAccount = Schema.fromJsonString(
  Schema.Struct({
    input: Schema.Struct({
      data: Schema.Struct({ email: Schema.optional(Schema.String) }),
    }),
  })
);
const Claim = Schema.fromJsonString(
  Schema.Struct({ cursor: Schema.NullOr(Schema.String), userId: Schema.String })
);

/**
 * The text one Convex command prints, as the local backend answers it. The lookup of the
 * Owner's address finds the account `user-1` when `existing`, and nothing otherwise, which the
 * CLI prints as no text.
 */
function answerOf(args: readonly string[], users: string, existing: boolean) {
  if (Arr.contains(args, "data")) {
    return users;
  }
  if (Arr.contains(args, "adapter:findOne")) {
    return existing ? '{"_id":"user-1"}' : "";
  }
  if (
    Arr.contains(args, "auth/lifecycle:onCreate") ||
    Arr.contains(args, "tenancy/claims:run")
  ) {
    return "null";
  }
  return '{"_creationTime":1,"_id":"user-1"}';
}

/** Answers every command and keeps the commands in the order they ran. The Owner's Better Auth user is `user-1`. */
function answerCommands(users: string, existing = false) {
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(
        spec.stdoutPath,
        answerOf(spec.args, users, existing)
      );
    })
  );
  return specs;
}

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-owner-test-",
  });
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  return { fs, root };
});

/** The JSON argument that the command takes last. */
const lastArgument = (spec: CommandSpec) =>
  Option.getOrThrow(Arr.last(spec.args));

describe("acceptance owner", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "signs the Owner in as a member by claiming the school for the new account's app user",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands(
          '[{"_id":"app-user-0","authId":"someone-else"},{"_id":"app-user-1","authId":"user-1"}]'
        );

        yield* createAcceptanceOwner(root, SLUG, `${root}/owner.json`);

        const calls = MutableList.toArray(specs);
        const accountCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "adapter:create")
          )
        );
        const account = yield* Schema.decodeEffect(CreatedAccount)(
          lastArgument(accountCall)
        );
        expect(account.input.data.email).toBe(ownerAddress(SLUG));
        const claimCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "tenancy/claims:run")
          )
        );
        expect(
          yield* Schema.decodeEffect(Claim)(lastArgument(claimCall))
        ).toEqual({ cursor: null, userId: "app-user-1" });
        const cookie = yield* fs
          .readFileString(`${root}/owner.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "signs the same Owner in again as the account that holds the address, with a new session and no second account",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands(
          '[{"_id":"app-user-1","authId":"user-1"}]',
          true
        );

        yield* createAcceptanceOwner(root, SLUG, `${root}/owner.json`);

        const created = Arr.filter(MutableList.toArray(specs), (spec) =>
          Arr.contains(spec.args, "adapter:create")
        );
        expect(Arr.map(created, (spec) => lastArgument(spec))).toEqual([
          expect.stringContaining('"model":"session"'),
        ]);
        const cookie = yield* fs
          .readFileString(`${root}/owner.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "claims nothing and writes no cookie when the new account has no app user",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands("[]");

        const exit = yield* Effect.exit(
          createAcceptanceOwner(root, SLUG, `${root}/owner.json`)
        );

        expect(Exit.isFailure(exit)).toBe(true);
        expect(
          Arr.some(MutableList.toArray(specs), (spec) =>
            Arr.contains(spec.args, "tenancy/claims:run")
          )
        ).toBe(false);
        expect(yield* fs.exists(`${root}/owner.json`)).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("signs no Owner in when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-owner-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceOwner(root, SLUG, `${root}/owner.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "signs the Owner in and writes the cookie to the file that the owner mode names",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        answerCommands('[{"_id":"app-user-1","authId":"user-1"}]');

        yield* ownerMode.run(root, [SLUG, `${root}/mode.json`, "ignored"]);

        const cookie = yield* fs
          .readFileString(`${root}/mode.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "refuses the owner mode without its school and cookie file before any operation",
    () =>
      Effect.gen(function* () {
        const { root } = yield* fixture;
        const specs = answerCommands("[]");

        expect(
          yield* ownerMode.run(root, [SLUG]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: "Usage: acceptance owner <school-slug> <cookie-file>",
        });
        expect(MutableList.toArray(specs)).toEqual([]);
        expect(mocks.read).not.toHaveBeenCalled();
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});
