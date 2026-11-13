import { describe, expect, it } from "@effect/vitest";
import {
  openLearnerAccount,
  signInAccount,
} from "@repo/backend/scripts/content/acceptance/account";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/convex";
import {
  ACCESS_TOKEN,
  accessTokenOf,
  SESSION_COOKIES,
} from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Array as Arr, Effect, MutableList, Option, Record } from "effect";

const LEARNER_EMAIL = /^learner-[0-9a-f]{16}@acceptance\.invalid$/u;
const TOKENS = {
  accessToken: ACCESS_TOKEN,
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: 1,
  userId: "user-1",
};

/** The arguments of one call to a runner: operation, the call, secrets. */
type Call = Parameters<RunConvex<string, never>>;

/**
 * A runner that answers the way the acceptance seed and Convex Auth's
 * password sign-in do, and records each call. `answers` replaces an answer
 * by operation, and the operations in `failing` fail with their own name.
 */
function recordingRunner(
  answers: Record<string, unknown> = {},
  failing: readonly string[] = []
) {
  const calls = MutableList.make<Call>();
  const run: RunConvex<string, never> = (...call) => {
    MutableList.append(calls, call);
    const [operation] = call;
    if (Arr.contains(failing, operation)) {
      return Effect.fail(`${operation} failed`);
    }
    const answer = Record.get(answers, operation);
    if (Option.isSome(answer)) {
      return Effect.succeed(answer.value);
    }
    return Effect.succeed(
      operation === "Learner account"
        ? { password: "seed-password", userId: "user-1" }
        : { status: "complete", tokens: TOKENS }
    );
  };
  return { calls: () => MutableList.toArray(calls), run };
}

describe("content acceptance account", () => {
  it.effect(
    "seeds a synthetic learner, signs it in with its password, and answers its session and the session's cookies",
    () =>
      Effect.gen(function* () {
        const runner = recordingRunner();
        const account = yield* openLearnerAccount(runner.run);
        expect(account).toEqual({
          cookies: SESSION_COOKIES,
          sessionId: "session-1",
          userId: "user-1",
        });
        const [seed, signIn] = runner.calls();
        expect(seed?.[0]).toBe("Learner account");
        expect(seed?.[1]).toMatchObject({
          args: { name: "Acceptance Learner" },
          path: "acceptance/accounts:create",
        });
        expect(seed?.[1].args).toMatchObject({
          email: expect.stringMatching(LEARNER_EMAIL),
        });
        expect(signIn).toEqual([
          "Learner sign-in",
          {
            args: { password: "seed-password", username: "user-1" },
            path: "auth/core:signInWithUsernamePassword",
          },
        ]);
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "signs in the account that holds an address, and gives every other call a learner of its own",
    () =>
      Effect.gen(function* () {
        const runner = recordingRunner();
        yield* openLearnerAccount(runner.run, "guru@acceptance.invalid");
        yield* openLearnerAccount(runner.run);
        yield* openLearnerAccount(runner.run);
        const emails = Arr.map(
          Arr.filter(
            runner.calls(),
            ([operation]) => operation === "Learner account"
          ),
          ([, call]) => call.args
        );
        expect(emails[0]).toMatchObject({ email: "guru@acceptance.invalid" });
        expect(emails[1]).not.toEqual(emails[2]);
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "stops before the sign-in when the seed fails or answers no account",
    () =>
      Effect.gen(function* () {
        const failed = recordingRunner({}, ["Learner account"]);
        expect(yield* Effect.flip(openLearnerAccount(failed.run))).toBe(
          "Learner account failed"
        );
        const malformed = recordingRunner({ "Learner account": { userId: 1 } });
        expect(
          yield* Effect.flip(openLearnerAccount(malformed.run))
        ).toMatchObject({ _tag: "SchemaError" });
        for (const runner of [failed, malformed]) {
          expect(Arr.map(runner.calls(), ([operation]) => operation)).toEqual([
            "Learner account",
          ]);
        }
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "refuses a sign-in that made no session, or whose token names none",
    () =>
      Effect.gen(function* () {
        const account = { password: "wrong", userId: "user-1" };
        const refused = recordingRunner({
          "Learner sign-in": {
            status: "error",
            userError: { error: "INVALID_CREDENTIALS" },
          },
        });
        const nameless = recordingRunner({
          "Learner sign-in": {
            status: "complete",
            tokens: { ...TOKENS, accessToken: accessTokenOf({}) },
          },
        });
        for (const runner of [refused, nameless]) {
          expect(
            yield* Effect.flip(signInAccount(runner.run, account))
          ).toMatchObject({ _tag: "SchemaError" });
        }
      })
  );
});
