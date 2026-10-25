import { describe, expect, it } from "@effect/vitest";
import { SessionRequired } from "@repo/backend/confect/auth/spec";
import { Effect, Result } from "effect";
import {
  finishOnboarding,
  saveOnboardingDraft,
} from "@/components/programs/onboarding/submit";

describe("onboarding submission", () => {
  it.effect("saves one draft answer without invoking Finish", () =>
    Effect.gen(function* () {
      const saveAnswer = vi.fn(async () =>
        Result.succeed({ updatedAt: 1, region: "united-states" as const })
      );
      yield* saveOnboardingDraft(saveAnswer, {
        answer: { kind: "region", value: "united-states" },
      });
      expect(saveAnswer).toHaveBeenCalledWith({
        answer: { kind: "region", value: "united-states" },
      });
    })
  );

  it.effect("commits all answers through one atomic Finish call", () =>
    Effect.gen(function* () {
      const finish = vi.fn(() =>
        Promise.resolve(
          Result.succeed({
            destination: { kind: "tryout" as const },
            locale: "en" as const,
          })
        )
      );
      const answers = {
        focus: "tryout" as const,
        region: "singapore" as const,
        role: "teacher" as const,
      };
      const result = yield* finishOnboarding(finish, { answers });

      expect(finish).toHaveBeenCalledOnce();
      expect(finish).toHaveBeenCalledWith({ answers });
      expect(result).toEqual({
        destination: { kind: "tryout" },
        locale: "en",
      });
    })
  );

  it.effect(
    "preserves a declared rejection instead of accepting it as saved",
    () =>
      Effect.gen(function* () {
        const cause = new SessionRequired({
          code: "UNAUTHENTICATED",
          message: "Unauthenticated",
        });
        const save = vi.fn(async () => Result.fail(cause));
        const draft = yield* saveOnboardingDraft(save, {
          answer: { kind: "role", value: "student" },
        }).pipe(Effect.flip);
        const finish = yield* finishOnboarding(async () => Result.fail(cause), {
          answers: {
            focus: "learning",
            region: "international",
            role: "student",
          },
        }).pipe(Effect.flip);
        expect(draft.cause).toBe(cause);
        expect(finish.cause).toBe(cause);
        expect(save).toHaveBeenCalledOnce();
      })
  );

  it.effect("keeps mutation failures in the typed browser error channel", () =>
    Effect.gen(function* () {
      const cause = new Error("network unavailable");
      const failure = yield* saveOnboardingDraft(
        async () => Promise.reject(cause),
        { answer: { kind: "role", value: "student" } }
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "OnboardingMutationError",
        cause,
      });
    })
  );

  it.effect("maps Finish rejection into the same typed failure", () =>
    Effect.gen(function* () {
      const cause = new Error("finish rejected");
      const failure = yield* finishOnboarding(
        async () => Promise.reject(cause),
        {
          answers: {
            focus: "learning",
            region: "international",
            role: "student",
          },
        }
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({ cause });
    })
  );
});
