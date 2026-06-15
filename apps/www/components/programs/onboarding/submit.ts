import { Effect, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import {
  decodeOnboardingValue,
  type OnboardingFormValue,
  type OnboardingState,
} from "./state";

type SelectProgramMutation = (value: OnboardingFormValue) => Promise<unknown>;

/** Expected failure when the browser submits an incomplete form value. */
class OnboardingValidationError extends Schema.TaggedError<OnboardingValidationError>()(
  "OnboardingValidationError",
  {
    cause: Schema.Unknown,
  }
) {}

/** Expected failure when the selected profile cannot be saved. */
class OnboardingMutationError extends Schema.TaggedError<OnboardingMutationError>()(
  "OnboardingMutationError",
  {
    cause: Schema.Unknown,
  }
) {}

/** Saves the selected program through the Convex mutation and returns form state. */
export function submitOnboardingSelection({
  selectProgram,
  value,
}: {
  selectProgram: SelectProgramMutation;
  value: unknown;
}) {
  return parseOnboardingValue(value).pipe(
    Effect.flatMap((formValue) =>
      Effect.tryPromise({
        try: () => selectProgram(formValue),
        catch: (cause) => new OnboardingMutationError({ cause }),
      })
    ),
    Effect.matchEffect({
      onFailure: recoverSubmissionFailure,
      onSuccess: () =>
        Effect.succeed({
          status: "success",
        } satisfies OnboardingState),
    })
  );
}

/** Decodes TanStack Form's draft value before saving the selected program. */
const parseOnboardingValue = Effect.fn("www.programs.parseOnboardingForm")(
  function* (value: unknown) {
    return yield* decodeOnboardingValue(value).pipe(
      Effect.mapError((cause) => new OnboardingValidationError({ cause }))
    );
  }
);

/** Converts handled browser submission failures into form state. */
function recoverSubmissionFailure(
  error: OnboardingValidationError | OnboardingMutationError
): Effect.Effect<OnboardingState> {
  if (error._tag === "OnboardingValidationError") {
    return Effect.succeed({
      messageKey: "onboarding.invalid-selection",
      status: "error",
    } satisfies OnboardingState);
  }

  return reportClientException(error, {
    source: "program-onboarding",
  }).pipe(
    Effect.as({
      messageKey: "onboarding.save-error",
      status: "error",
    } satisfies OnboardingState)
  );
}
