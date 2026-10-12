import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  createLearnerAccount,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/account";
import {
  Array as Arr,
  Duration,
  Effect,
  MutableList,
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
        data: Schema.Struct({
          createdAt: Schema.Finite,
          email: Schema.optional(Schema.String),
          expiresAt: Schema.optional(Schema.Finite),
          token: Schema.optional(Schema.String),
          userId: Schema.optional(Schema.String),
        }),
        model: Schema.String,
      })
    ),
  })
);

/** The arguments of one call to a runner: operation, CLI arguments, secrets. */
type Call = Parameters<RunConvex<never, never>>;

/** A runner that answers the way the Better Auth adapter does and records each call. */
function recordingRunner() {
  const calls = MutableList.make<Call>();
  const run: RunConvex<never, never> = (...call) => {
    MutableList.append(calls, call);
    const [operation] = call;
    if (operation === "Learner account") {
      return Effect.succeed('{"_creationTime":1,"_id":"user-1","extra":true}');
    }
    if (operation === "Learner session") {
      return Effect.succeed('{"_creationTime":2,"_id":"session-1"}');
    }
    return Effect.succeed("null");
  };
  return { calls, run };
}

const readInput = ([, args]: Call) =>
  Schema.decodeEffect(CommandInput)(Option.getOrThrow(Arr.last(args)));

describe("synthetic learner account", () => {
  it.effect(
    "creates the account, the profile and a session that lasts as long as asked",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { calls, run } = recordingRunner();

        const account = yield* createLearnerAccount(run, LIFETIME);

        const made = MutableList.toArray(calls);
        expect(Arr.map(made, ([operation]) => operation)).toEqual([
          "Learner account",
          "Learner profile",
          "Learner session",
        ]);
        expect(Arr.map(made, ([, args]) => Arr.dropRight(args, 1))).toEqual([
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "auth/lifecycle:onCreate"],
          ["run", "--component", "betterAuth", "adapter:create"],
        ]);
        const [user, profile, session] = yield* Effect.forEach(made, readInput);
        expect(user?.input?.model).toBe("user");
        expect(user?.input?.data.email).toMatch(LEARNER_EMAIL);
        expect(profile?.doc?._id).toBe("user-1");
        expect(session?.input?.model).toBe("session");
        expect(session?.input?.data.userId).toBe("user-1");
        expect(session?.input?.data.createdAt).toBe(NOW);
        expect(session?.input?.data.expiresAt).toBe(
          NOW + Duration.toMillis(LIFETIME)
        );
        const token = session?.input?.data.token ?? "";
        expect(token).toHaveLength(43);
        expect(Arr.map(made, ([, , secrets]) => secrets)).toEqual([
          undefined,
          undefined,
          [token],
        ]);
        expect(account).toEqual({
          sessionId: "session-1",
          token,
          userId: "user-1",
        });
      }).pipe(Effect.provide(nodeServicesLayer))
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
      expect(firstUser?.input?.data.email).not.toBe(
        secondUser?.input?.data.email
      );
      expect(first.token).not.toBe(second.token);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("stops before the profile when the account was not created", () =>
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
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("fails when the session it opened cannot be read back", () =>
    Effect.gen(function* () {
      const run: RunConvex<never, never> = (operation) =>
        Effect.succeed(
          operation === "Learner session"
            ? "Uncaught ConvexError"
            : '{"_creationTime":1,"_id":"user-1"}'
        );

      const error = yield* createLearnerAccount(run, LIFETIME).pipe(
        Effect.flip
      );

      expect(error._tag).toBe("SchemaError");
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});
