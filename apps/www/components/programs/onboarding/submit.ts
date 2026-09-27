import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type refs from "@repo/backend/confect/_generated/refs";

import { Effect, Schema } from "effect";

type SaveAnswerArgs = Ref.Args<
  typeof refs.public.onboarding.mutations.saveAnswer
>;
type FinishArgs = Ref.Args<typeof refs.public.onboarding.mutations.finish>;
type SaveAnswerMutation = (
  args: SaveAnswerArgs
) => InvokeReturn<typeof refs.public.onboarding.mutations.saveAnswer>;
type FinishMutation = (
  args: FinishArgs
) => InvokeReturn<typeof refs.public.onboarding.mutations.finish>;

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
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError((cause) => new OnboardingMutationError({ cause }))
        )
      )
    );
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
  }).pipe(
    Effect.flatMap((result) =>
      Effect.fromResult(result).pipe(
        Effect.mapError((cause) => new OnboardingMutationError({ cause }))
      )
    )
  );
});
