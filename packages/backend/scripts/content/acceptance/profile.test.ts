import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/account";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  profileMode,
  updateAcceptanceProfile,
  updateLearnerProfile,
} from "@repo/backend/scripts/content/acceptance/profile";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";

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

const NOW = 1_700_000_000_000;
const PHOTO = "https://example.com/ada.png";
/** The learner's row in Better Auth before the write, with a field the trigger does not read. */
const BEFORE = `{"_creationTime":1,"_id":"user-1","email":"learner@acceptance.invalid","emailVerified":true,"image":null,"name":"Acceptance Learner","session":"not projected"}`;
/** The learner's row in Better Auth after the write. */
const AFTER = `{"_creationTime":1,"_id":"user-1","email":"learner@acceptance.invalid","emailVerified":true,"image":"${PHOTO}","name":"Ada","updatedAt":${NOW}}`;
/** The fields of a Better Auth row that the app's trigger reads. */
const PROJECTED_BEFORE = {
  _id: "user-1",
  email: "learner@acceptance.invalid",
  emailVerified: true,
  image: null,
  name: "Acceptance Learner",
};
const PROJECTED_AFTER = {
  _id: "user-1",
  email: "learner@acceptance.invalid",
  emailVerified: true,
  image: PHOTO,
  name: "Ada",
};

/** The arguments of one call to a runner: operation, CLI arguments, secrets. */
type Call = Parameters<RunConvex<string, never>>;
type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

/** What the local backend answers for each call of one update, by the name of the call. */
function answerOf(operation: string) {
  if (operation === "Learner account read") {
    return BEFORE;
  }
  if (operation === "Learner profile write") {
    return AFTER;
  }
  return "null";
}

/** A runner that answers with `answerOf` and records each call. */
function recordingRunner(answer: (operation: string) => string) {
  const calls = MutableList.make<Call>();
  const run: RunConvex<string, never> = (...call) => {
    MutableList.append(calls, call);
    return Effect.succeed(answer(call[0]));
  };
  return { calls, run };
}

/** The JSON value that a call carried as its last argument. */
const readArguments = ([, args]: Call) =>
  Schema.decodeEffect(JsonTextSchema)(Option.getOrThrow(Arr.last(args)));
/** The JSON value that a command carried as its last argument. */
const readCommand = (spec: CommandSpec) =>
  Schema.decodeEffect(JsonTextSchema)(Option.getOrThrow(Arr.last(spec.args)));

describe("synthetic learner profile", () => {
  it.effect(
    "writes the name and the photo address, then runs the app's update trigger with the row before and after",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { calls, run } = recordingRunner(answerOf);

        yield* updateLearnerProfile(run, "user-1", {
          image: PHOTO,
          name: "Ada",
        });

        const made = MutableList.toArray(calls);
        expect(Arr.map(made, ([operation]) => operation)).toEqual([
          "Learner account read",
          "Learner profile write",
          "Learner profile sync",
        ]);
        expect(Arr.map(made, ([, args]) => Arr.dropRight(args, 1))).toEqual([
          ["run", "--component", "betterAuth", "adapter:findOne"],
          ["run", "--component", "betterAuth", "adapter:updateOne"],
          ["run", "auth/lifecycle:onUpdate"],
        ]);
        const [read, write, sync] = yield* Effect.forEach(made, readArguments);
        expect(read).toEqual({
          model: "user",
          where: [{ field: "_id", operator: "eq", value: "user-1" }],
        });
        expect(write).toEqual({
          input: {
            model: "user",
            update: { image: PHOTO, name: "Ada", updatedAt: NOW },
            where: [{ field: "_id", operator: "eq", value: "user-1" }],
          },
        });
        expect(sync).toEqual({
          model: "user",
          newDoc: PROJECTED_AFTER,
          oldDoc: PROJECTED_BEFORE,
        });
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("writes only the field that the test names", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { calls, run } = recordingRunner(answerOf);

      yield* updateLearnerProfile(run, "user-1", { name: "Ada" });

      const [, write] = yield* Effect.forEach(
        MutableList.toArray(calls),
        readArguments
      );
      expect(write).toEqual({
        input: {
          model: "user",
          update: { name: "Ada", updatedAt: NOW },
          where: [{ field: "_id", operator: "eq", value: "user-1" }],
        },
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("writes nothing when no account has the auth id", () =>
    Effect.gen(function* () {
      const { calls, run } = recordingRunner(() => "null");

      const error = yield* updateLearnerProfile(run, "user-2", {
        name: "Ada",
      }).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "No learner account has the auth id user-2.",
      });
      expect(Arr.map(MutableList.toArray(calls), ([op]) => op)).toEqual([
        "Learner account read",
      ]);
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});

describe("acceptance profile command", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect("writes the profile of the learner in the running runtime", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-profile-test-",
      });
      const file = `${root}/profile.json`;
      yield* fs.writeFileString(file, '{"name":"Ada"}');
      mocks.read.mockReturnValue(
        Effect.succeed({ backend: `${root}/backend` })
      );
      const specs = MutableList.make<CommandSpec>();
      mocks.command.mockImplementation((spec: CommandSpec) =>
        Effect.gen(function* () {
          MutableList.append(specs, spec);
          yield* fs.writeFileString(spec.stdoutPath, answerOf(spec.operation));
        })
      );

      yield* updateAcceptanceProfile(root, "user-1", file);

      const calls = MutableList.toArray(specs);
      expect(Arr.map(calls, (spec) => spec.operation)).toEqual([
        "Learner account read",
        "Learner profile write",
        "Learner profile sync",
      ]);
      for (const spec of calls) {
        expect(spec.args[0]).toBe("node_modules/convex/bin/main.js");
        expect(spec.cwd).toBe(`${root}/backend`);
        expect(spec.env?.CONVEX_DEPLOY_KEY).toBeUndefined();
      }
      const [, write] = yield* Effect.forEach(calls, readCommand);
      expect(write).toEqual({
        input: {
          model: "user",
          update: { name: "Ada", updatedAt: NOW },
          where: [{ field: "_id", operator: "eq", value: "user-1" }],
        },
      });
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("requires a prepared and running local runtime", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);

      const error = yield* updateAcceptanceProfile(
        "/missing",
        "user-1",
        "/missing/profile.json"
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("acceptance:prepare"),
      });
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "writes the profile that the profile mode names for the auth id it names, ignoring an extra argument",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-profile-test-",
        });
        const file = `${root}/profile.json`;
        yield* fs.writeFileString(file, '{"name":"Ada"}');
        mocks.read.mockReturnValue(
          Effect.succeed({ backend: `${root}/backend` })
        );
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(
              spec.stdoutPath,
              answerOf(spec.operation)
            );
          })
        );

        yield* profileMode.run(root, ["user-1", file, "ignored"]);

        const [, write] = yield* Effect.forEach(
          MutableList.toArray(specs),
          readCommand
        );
        expect(write).toEqual({
          input: {
            model: "user",
            update: { name: "Ada", updatedAt: NOW },
            where: [{ field: "_id", operator: "eq", value: "user-1" }],
          },
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "refuses the profile mode without its profile file before any operation",
    () =>
      Effect.gen(function* () {
        expect(
          yield* profileMode.run("/root", ["user-1"]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message:
            "Usage: acceptance profile <auth-user-id> <profile-json-file>",
        });
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});
