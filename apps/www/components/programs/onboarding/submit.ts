import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type SaveAnswerArgs = FunctionArgs<typeof api.onboarding.mutations.saveAnswer>;
type FinishArgs = FunctionArgs<typeof api.onboarding.mutations.finish>;
type FinishResult = FunctionReturnType<typeof api.onboarding.mutations.finish>;
type SaveAnswerMutation = (args: SaveAnswerArgs) => Promise<unknown>;
type FinishMutation = (args: FinishArgs) => Promise<FinishResult>;

/** Expected browser mutation failure while saving onboarding state. */
export class OnboardingMutationError extends Schema.TaggedError<OnboardingMutationError>()(
  "OnboardingMutationError",
  { cause: Schema.Unknown }
) {}

/** Saves one draft answer through the browser's typed failure channel. */
export const saveOnboardingDraft = Effect.fn("www.onboarding.saveDraft")(
  function* (saveAnswer: SaveAnswerMutation, args: SaveAnswerArgs) {
    yield* Effect.tryPromise({
      catch: (cause) => new OnboardingMutationError({ cause }),
      try: () => saveAnswer(args),
    });
  }
);

/** Commits every answer and derived preference through one atomic mutation. */
export const finishOnboarding = Effect.fn("www.onboarding.finish")(function* (
  finish: FinishMutation,
  args: FinishArgs
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new OnboardingMutationError({ cause }),
    try: () => finish(args),
  });
});
