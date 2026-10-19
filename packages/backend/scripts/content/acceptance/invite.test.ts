import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceInvite,
  inviteMode,
  waitForInboxRow,
} from "@repo/backend/scripts/content/acceptance/invite";
import {
  Array as Arr,
  Duration,
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
const ADDRESS = "learner-1a2b3c4d@acceptance.example.test";
const APP_USERS =
  '[{"_id":"app-user-0","authId":"someone-else"},{"_id":"app-user-1","authId":"user-1"}]';
const INVITED = '{"invite":"invite-1","person":"person-1"}';
const INBOX_ROWS = '[{"recipientPersonId":"person-1"}]';
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
const InviteArgs = Schema.fromJsonString(
  Schema.Struct({
    email: Schema.String,
    locale: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  })
);

/** The text one Convex command prints, as the local backend answers it. */
function answerOf(
  args: readonly string[],
  users: string,
  rows: string,
  account: string
) {
  if (Arr.contains(args, "adapter:findOne")) {
    return account;
  }
  if (Arr.contains(args, "data")) {
    return Arr.contains(args, "notifications") ? rows : users;
  }
  if (Arr.contains(args, "tenancy/provision:invite")) {
    return INVITED;
  }
  if (
    Arr.contains(args, "auth/lifecycle:onCreate") ||
    Arr.contains(args, "tenancy/claims:run")
  ) {
    return "null";
  }
  return '{"_creationTime":1,"_id":"user-1"}';
}

/** Answers every command and keeps the commands in the order they ran. The new account's Better Auth user is `user-1`. */
function answerCommands(
  users: string,
  rows: string = INBOX_ROWS,
  account = "null"
) {
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(
        spec.stdoutPath,
        answerOf(spec.args, users, rows, account)
      );
    })
  );
  return specs;
}

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-invite-test-",
  });
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  return { fs, root };
});

/** The JSON argument that the command takes last. */
const lastArgument = (spec: CommandSpec) =>
  Option.getOrThrow(Arr.last(spec.args));

describe("acceptance invite", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "invites the address into the school, claims it for the learner's account, and writes the cookie",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands(APP_USERS);

        yield* createAcceptanceInvite(
          root,
          SLUG,
          ADDRESS,
          `${root}/invite.json`
        );

        const calls = MutableList.toArray(specs);
        const inviteCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "tenancy/provision:invite")
          )
        );
        expect(
          yield* Schema.decodeEffect(InviteArgs)(lastArgument(inviteCall))
        ).toEqual({
          email: ADDRESS,
          locale: "id",
          name: "Acceptance Learner",
          slug: SLUG,
        });
        const accountCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "adapter:create")
          )
        );
        const account = yield* Schema.decodeEffect(CreatedAccount)(
          lastArgument(accountCall)
        );
        expect(account.input.data.email).toBe(ADDRESS);
        const claimCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "tenancy/claims:run")
          )
        );
        expect(
          yield* Schema.decodeEffect(Claim)(lastArgument(claimCall))
        ).toEqual({ cursor: null, userId: "app-user-1" });
        const cookie = yield* fs
          .readFileString(`${root}/invite.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "signs an account that already holds the address in again, creating none, and claims the invitation for it",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands(APP_USERS, INBOX_ROWS, '{"_id":"user-1"}');
        const SessionCreate = Schema.fromJsonString(
          Schema.Struct({
            input: Schema.Struct({
              data: Schema.Struct({ userId: Schema.String }),
              model: Schema.Literal("session"),
            }),
          })
        );

        yield* createAcceptanceInvite(
          root,
          SLUG,
          ADDRESS,
          `${root}/invite.json`
        );

        const calls = MutableList.toArray(specs);
        const creations = Arr.filter(calls, (spec) =>
          Arr.contains(spec.args, "adapter:create")
        );
        expect(creations).toHaveLength(1);
        expect(
          yield* Schema.decodeEffect(SessionCreate)(
            lastArgument(Option.getOrThrow(Arr.head(creations)))
          )
        ).toMatchObject({ input: { data: { userId: "user-1" } } });
        const claimCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "tenancy/claims:run")
          )
        );
        expect(
          yield* Schema.decodeEffect(Claim)(lastArgument(claimCall))
        ).toEqual({ cursor: null, userId: "app-user-1" });
        const cookie = yield* fs
          .readFileString(`${root}/invite.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "claims nothing and writes no cookie when the new account has no app user",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands("[]");

        const exit = yield* Effect.exit(
          createAcceptanceInvite(root, SLUG, ADDRESS, `${root}/invite.json`)
        );

        expect(Exit.isFailure(exit)).toBe(true);
        expect(
          Arr.some(MutableList.toArray(specs), (spec) =>
            Arr.contains(spec.args, "tenancy/claims:run")
          )
        ).toBe(false);
        expect(yield* fs.exists(`${root}/invite.json`)).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("invites no learner when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-invite-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceInvite(root, SLUG, ADDRESS, `${root}/invite.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live("fails when no inbox row belongs to the invited person in time", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        waitForInboxRow(
          () => Effect.succeed("[]"),
          "person-1",
          Duration.millis(1)
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect(
    "invites the learner the invite mode names and writes the cookie to the file it names",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        answerCommands(APP_USERS);

        yield* inviteMode.run(root, [
          SLUG,
          ADDRESS,
          `${root}/mode.json`,
          "ignored",
        ]);

        const cookie = yield* fs
          .readFileString(`${root}/mode.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "refuses the invite mode without its address and cookie file before any operation",
    () =>
      Effect.gen(function* () {
        const { root } = yield* fixture;
        const specs = answerCommands(APP_USERS);

        expect(
          yield* inviteMode.run(root, [SLUG, ADDRESS]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message:
            "Usage: acceptance invite <school-slug> <learner-address> <cookie-file>",
        });
        expect(MutableList.toArray(specs)).toEqual([]);
        expect(mocks.read).not.toHaveBeenCalled();
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
