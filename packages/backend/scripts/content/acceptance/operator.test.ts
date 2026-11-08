import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceOperator,
  operatorMode,
} from "@repo/backend/scripts/content/acceptance/operator";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  Effect,
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

/** What `tenancy/seed:user` prints for the new account: the id of its app user. */
const APP_USER = '"app-1"';

/** Answers each Convex command the way the local backend does. */
function answerCommands(appUser: string | null = APP_USER) {
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      const fs = yield* FileSystem.FileSystem;
      // The seed of the app user prints its id, and fails for an account without one.
      const output = Arr.contains(spec.args, "tenancy/seed:user")
        ? appUser
        : '{"_creationTime":1,"_id":"user-1"}';
      if (output === null) {
        return yield* acceptanceRuntimeError("The account has no app user.");
      }
      yield* fs.writeFileString(spec.stdoutPath, output);
    })
  );
  return specs;
}

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-operator-test-",
  });
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  return { fs, root };
});

describe("synthetic acceptance operator", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "grants a new learner operator access before it writes its cookie",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands();

        yield* operatorMode.run(root, [`${root}/cookie.json`]);

        const grant = Option.getOrThrow(
          Arr.findFirst(MutableList.toArray(specs), (spec) =>
            Arr.contains(spec.args, "operators/staff:grant")
          )
        );
        expect(Arr.last(grant.args)).toEqual(Option.some('{"userId":"app-1"}'));
        const cookie = yield* fs
          .readFileString(`${root}/cookie.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses without a prepared runtime", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      mocks.read.mockReturnValue(Effect.undefined);

      const error = yield* createAcceptanceOperator(
        root,
        `${root}/cookie.json`
      ).pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      expect(yield* fs.exists(`${root}/cookie.json`)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("writes no cookie when the account has no app user", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      answerCommands(null);

      const error = yield* createAcceptanceOperator(
        root,
        `${root}/cookie.json`
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The account has no app user.",
      });
      expect(yield* fs.exists(`${root}/cookie.json`)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});
