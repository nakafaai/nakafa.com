import { describe, expect, it } from "@effect/vitest";
import {
  createLearnerAccount,
  openLearnerAccount,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/account";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  Duration,
  Effect,
  Logger,
  MutableList,
  MutableRef,
  Option,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";

const NOW = 1_700_000_000_000;
const LIFETIME = Duration.minutes(30);
const LEARNER_EMAIL = /^learner-[0-9a-f]{16}@acceptance\.invalid$/u;

/** What each command carries that the tests read back. */
const CommandInput = Schema.fromJsonString(
  Schema.Struct({
    doc: Schema.optional(Schema.Struct({ _id: Schema.String })),
    input: Schema.optional(
      Schema.Struct({
        data: Schema.optional(
          Schema.Struct({
            createdAt: Schema.Finite,
            email: Schema.optional(Schema.String),
            expiresAt: Schema.optional(Schema.Finite),
            token: Schema.optional(Schema.String),
            userId: Schema.optional(Schema.String),
          })
        ),
        model: Schema.String,
        where: Schema.optional(
          Schema.Array(
            Schema.Struct({
              field: Schema.String,
              operator: Schema.String,
              value: Schema.String,
            })
          )
        ),
      })
    ),
  })
);

/** The arguments of one call to a runner: operation, CLI arguments, secrets. */
type Call = Parameters<RunConvex<string, never>>;

/**
 * A runner that answers the way the Better Auth adapter does and records each
 * call. The operations in `failing` fail with their own name.
 */
function recordingRunner(failing: readonly string[] = [], lookup = "") {
  const calls = MutableList.make<Call>();
  const run: RunConvex<string, never> = (...call) => {
    MutableList.append(calls, call);
    const [operation] = call;
    if (Arr.contains(failing, operation)) {
      return Effect.fail(`${operation} failed`);
    }
    if (operation === "Learner account") {
      return Effect.succeed('{"_creationTime":1,"_id":"user-1","extra":true}');
    }
    if (operation === "Learner session") {
      return Effect.succeed('{"_creationTime":2,"_id":"session-1"}');
    }
    if (operation === "Learner account lookup") {
      return Effect.succeed(lookup);
    }
    return Effect.succeed("null");
  };
  return { calls, run };
}

const readInput = ([, args]: Call) =>
  Schema.decodeEffect(CommandInput)(Option.getOrThrow(Arr.last(args)));

/** The operations of the calls a runner recorded, in order. */
const operations = (calls: MutableList.MutableList<Call>) =>
  Arr.map(MutableList.toArray(calls), ([operation]) => operation);

describe("opening a learner account", () => {
  const ADDRESS = "learner-1a2b3c4d@acceptance.example.test";

  it.effect(
    "signs the account that holds the address in again, with a new session and no new account",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { calls, run } = recordingRunner([], '{"_id":"user-7"}');

        const account = yield* openLearnerAccount(run, LIFETIME, ADDRESS);

        expect(account).toMatchObject({
          sessionId: "session-1",
          userId: "user-7",
        });
        expect(operations(calls)).toEqual([
          "Learner account lookup",
          "Learner session",
        ]);
        const session = Option.getOrThrow(
          Arr.findFirst(
            MutableList.toArray(calls),
            ([operation]) => operation === "Learner session"
          )
        );
        expect((yield* readInput(session)).input?.data?.userId).toBe("user-7");
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "creates the account with the address, its session, and its profile when no account holds it",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { calls, run } = recordingRunner();

        const account = yield* openLearnerAccount(run, LIFETIME, ADDRESS);

        expect(account.userId).toBe("user-1");
        expect(operations(calls)).toEqual([
          "Learner account lookup",
          "Learner account",
          "Learner session",
          "Learner profile",
        ]);
        const created = Option.getOrThrow(
          Arr.findFirst(
            MutableList.toArray(calls),
            ([operation]) => operation === "Learner account"
          )
        );
        expect((yield* readInput(created)).input?.data?.email).toBe(ADDRESS);
      }).pipe(Effect.provide(nodePlatform))
  );
});

describe("synthetic learner account", () => {
  it.effect(
    "creates the account, a session that lasts as long as asked, and the profile",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { calls, run } = recordingRunner();

        const account = yield* createLearnerAccount(run, LIFETIME);

        const made = MutableList.toArray(calls);
        expect(operations(calls)).toEqual([
          "Learner account",
          "Learner session",
          "Learner profile",
        ]);
        expect(Arr.map(made, ([, args]) => Arr.dropRight(args, 1))).toEqual([
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "auth/lifecycle:onCreate"],
        ]);
        const [user, session, profile] = yield* Effect.forEach(made, readInput);
        expect(user?.input?.model).toBe("user");
        expect(user?.input?.data?.email).toMatch(LEARNER_EMAIL);
        expect(session?.input?.model).toBe("session");
        expect(session?.input?.data?.userId).toBe("user-1");
        expect(session?.input?.data?.createdAt).toBe(NOW);
        expect(session?.input?.data?.expiresAt).toBe(
          NOW + Duration.toMillis(LIFETIME)
        );
        expect(profile?.doc?._id).toBe("user-1");
        const token = session?.input?.data?.token ?? "";
        expect(token).toHaveLength(43);
        expect(Arr.map(made, ([, , secrets]) => secrets)).toEqual([
          undefined,
          [token],
          undefined,
        ]);
        expect(account).toEqual({
          sessionId: "session-1",
          token,
          userId: "user-1",
        });
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("gives every call a learner of its own", () =>
    Effect.gen(function* () {
      const { calls, run } = recordingRunner();

      const first = yield* createLearnerAccount(run, LIFETIME);
      const second = yield* createLearnerAccount(run, LIFETIME);

      const [firstUser, , , secondUser] = yield* Effect.forEach(
        MutableList.toArray(calls),
        readInput
      );
      expect(firstUser?.input?.data?.email).not.toBe(
        secondUser?.input?.data?.email
      );
      expect(first.token).not.toBe(second.token);
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("stops before the session when the account was not created", () =>
    Effect.gen(function* () {
      const calls = MutableList.make<string>();
      const run: RunConvex<never, never> = (operation) => {
        MutableList.append(calls, operation);
        return Effect.succeed("Uncaught ConvexError");
      };

      const error = yield* createLearnerAccount(run, LIFETIME).pipe(
        Effect.flip
      );

      expect(error._tag).toBe("SchemaError");
      expect(MutableList.toArray(calls)).toEqual(["Learner account"]);
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "removes the account again when the session cannot be read back",
    () =>
      Effect.gen(function* () {
        const calls = MutableList.make<string>();
        const run: RunConvex<never, never> = (operation) => {
          MutableList.append(calls, operation);
          return Effect.succeed(
            operation === "Learner session"
              ? "Uncaught ConvexError"
              : '{"_creationTime":1,"_id":"user-1"}'
          );
        };

        const error = yield* createLearnerAccount(run, LIFETIME).pipe(
          Effect.flip
        );

        expect(error._tag).toBe("SchemaError");
        expect(MutableList.toArray(calls)).toEqual([
          "Learner account",
          "Learner session",
          "Learner account removal",
        ]);
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("removes the account again when the session cannot be opened", () =>
    Effect.gen(function* () {
      const { calls, run } = recordingRunner(["Learner session"]);

      const error = yield* createLearnerAccount(run, LIFETIME).pipe(
        Effect.flip
      );

      expect(error).toBe("Learner session failed");
      expect(operations(calls)).toEqual([
        "Learner account",
        "Learner session",
        "Learner account removal",
      ]);
      const removal = Option.getOrThrow(Arr.get(MutableList.toArray(calls), 2));
      expect(Arr.dropRight(removal[1], 1)).toEqual([
        "run",
        "--component",
        "betterAuth",
        "adapter:deleteOne",
      ]);
      expect((yield* readInput(removal)).input).toEqual({
        model: "user",
        where: [{ field: "_id", operator: "eq", value: "user-1" }],
      });
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "removes the session and then the account when the profile cannot be written",
    () =>
      Effect.gen(function* () {
        const { calls, run } = recordingRunner(["Learner profile"]);

        const error = yield* createLearnerAccount(run, LIFETIME).pipe(
          Effect.flip
        );

        expect(error).toBe("Learner profile failed");
        expect(operations(calls)).toEqual([
          "Learner account",
          "Learner session",
          "Learner profile",
          "Learner session removal",
          "Learner account removal",
        ]);
        const removals = yield* Effect.forEach(
          Arr.drop(MutableList.toArray(calls), 3),
          readInput
        );
        expect(Arr.map(removals, (removal) => removal.input)).toEqual([
          {
            model: "session",
            where: [{ field: "_id", operator: "eq", value: "session-1" }],
          },
          {
            model: "user",
            where: [{ field: "_id", operator: "eq", value: "user-1" }],
          },
        ]);
      }).pipe(Effect.provide(nodePlatform))
  );

  it.live(
    "fails with the step that failed and logs the rows a failed removal leaves",
    () =>
      Effect.gen(function* () {
        const logged = MutableRef.make<readonly unknown[]>([]);
        const { calls, run } = recordingRunner([
          "Learner profile",
          "Learner session removal",
          "Learner account removal",
        ]);

        const error = yield* createLearnerAccount(run, LIFETIME).pipe(
          Effect.flip,
          Effect.provide(
            Logger.layer([
              Logger.formatStructured.pipe(
                Logger.map(({ annotations, level, message }) =>
                  MutableRef.update(
                    logged,
                    Arr.append({ annotations, level, message })
                  )
                )
              ),
            ])
          )
        );

        expect(error).toBe("Learner profile failed");
        expect(operations(calls)).toEqual([
          "Learner account",
          "Learner session",
          "Learner profile",
          "Learner session removal",
          "Learner account removal",
        ]);
        expect(MutableRef.get(logged)).toEqual([
          {
            annotations: { id: "session-1", model: "session" },
            level: "WARN",
            message: "Learner session removal failed",
          },
          {
            annotations: { id: "user-1", model: "user" },
            level: "WARN",
            message: "Learner account removal failed",
          },
        ]);
      }).pipe(Effect.provide(nodePlatform))
  );
});
