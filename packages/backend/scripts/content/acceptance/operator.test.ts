import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceOperator,
  operatorMode,
} from "@repo/backend/scripts/content/acceptance/operator";
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

/** What the local backend prints for the app users of the runtime. */
const USERS = '[{"_id":"app-1","authId":"user-1"}]';

/** Answers each Convex command the way the local backend does. */
function answerCommands(users = USERS) {
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      const fs = yield* FileSystem.FileSystem;
      const output = Arr.contains(spec.args, "data")
        ? users
        : '{"_creationTime":1,"_id":"user-1"}';
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
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
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
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("writes no cookie when the account has no app user", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      answerCommands("[]");

      const error = yield* createAcceptanceOperator(
        root,
        `${root}/cookie.json`
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The new account has no app user.",
      });
      expect(yield* fs.exists(`${root}/cookie.json`)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
