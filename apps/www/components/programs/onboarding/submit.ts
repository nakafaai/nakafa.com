import { Effect, Schema } from "effect";
import {
  decodeOnboardingRoleValue,
  decodeOnboardingValue,
  type OnboardingFormValue,
  type OnboardingRoleValue,
  type OnboardingState,
} from "@/components/programs/onboarding/state";
import { reportClientException } from "@/lib/analytics/client";

type SelectProgramMutation = (
  value: Pick<OnboardingFormValue, "interests" | "primaryProgramKey">
) => Promise<unknown>;
type UpdateRoleMutation = (
  value: Pick<OnboardingFormValue, "role">
) => Promise<unknown>;

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

/** Saves the selected normal Nakafa role through the Convex mutation. */
export function submitOnboardingRole({
  updateRole,
  value,
}: {
  updateRole: UpdateRoleMutation;
  value: unknown;
}) {
  return parseOnboardingRoleValue(value).pipe(
    Effect.flatMap((formValue) =>
      saveOnboardingRole({ formValue, updateRole })
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

/** Saves the selected program through the Convex mutation and returns form state. */
export function submitOnboardingSelection({
  selectProgram,
  updateRole,
  value,
}: {
  selectProgram: SelectProgramMutation;
  updateRole: UpdateRoleMutation;
  value: unknown;
}) {
  return parseOnboardingValue(value).pipe(
    Effect.flatMap((formValue) =>
      saveOnboardingSelection({
        formValue,
        selectProgram,
        updateRole,
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

/** Saves the user role through its owning Convex mutation. */
function saveOnboardingRole({
  formValue,
  updateRole,
}: {
  formValue: OnboardingRoleValue;
  updateRole: UpdateRoleMutation;
}) {
  return Effect.tryPromise({
    try: () => updateRole({ role: formValue.role }),
    catch: (cause) => new OnboardingMutationError({ cause }),
  });
}

/** Saves role and learning profile through their owning Convex mutations. */
function saveOnboardingSelection({
  formValue,
  selectProgram,
  updateRole,
}: {
  formValue: OnboardingFormValue;
  selectProgram: SelectProgramMutation;
  updateRole: UpdateRoleMutation;
}) {
  return Effect.tryPromise({
    try: () => updateRole({ role: formValue.role }),
    catch: (cause) => new OnboardingMutationError({ cause }),
  }).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () =>
          selectProgram({
            interests: formValue.interests,
            primaryProgramKey: formValue.primaryProgramKey,
          }),
        catch: (cause) => new OnboardingMutationError({ cause }),
      })
    )
  );
}

/** Decodes TanStack Form's role-step value before saving the app role. */
const parseOnboardingRoleValue = Effect.fn("www.programs.parseRoleForm")(
  function* (value: unknown) {
    return yield* decodeOnboardingRoleValue(value).pipe(
      Effect.mapError((cause) => new OnboardingValidationError({ cause }))
    );
  }
);

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
