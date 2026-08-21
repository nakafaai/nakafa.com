import { mutation } from "@repo/backend/convex/functions";
import { saveLearningSelection } from "@repo/backend/convex/learningPreferences/impl";
import {
  requireSelectableProgram,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/selection";
import {
  activeLearningSelectionValidator,
  learningInterestValidator,
} from "@repo/backend/convex/learningPrograms/spec";
import {
  getUnknownErrorMessage,
  readConvexErrorData,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

const learningSelectionAuthFailedCode = "LEARNING_SELECTION_AUTH_FAILED";
const unauthenticatedCode = "UNAUTHENTICATED";
/** Expected authentication failure for a learning selection. */
class LearningSelectionAuthError extends Schema.TaggedError<LearningSelectionAuthError>()(
  "LearningSelectionAuthError",
  {
    code: Schema.Literals([
      learningSelectionAuthFailedCode,
      unauthenticatedCode,
    ]),
    message: Schema.String,
  }
) {}
/** Preserves expected auth failures and tags unknown boundary failures. */
function toLearningSelectionAuthError(error: unknown) {
  const known = readConvexErrorData(error);
  const message = known?.message ?? getUnknownErrorMessage(error);
  return new LearningSelectionAuthError({
    code:
      known?.code === unauthenticatedCode || message === "Unauthenticated"
        ? unauthenticatedCode
        : learningSelectionAuthFailedCode,
    message,
  });
}
/** Saves one current signed learner selection. */
export const selectProgram = mutation({
  args: {
    interest: learningInterestValidator,
    locale: localeValidator,
    programKey: v.string(),
  },
  returns: activeLearningSelectionValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          catch: toLearningSelectionAuthError,
          try: () => requireAuth(ctx),
        });
        const program = yield* requireSelectableProgram(
          ctx,
          args.locale,
          args.programKey,
          args.interest
        );
        const now = yield* Clock.currentTimeMillis;
        yield* saveLearningSelection({
          ctx,
          interest: args.interest,
          now,
          programKey: program.key,
          programKind: program.kind,
          replaceCurriculumPreference: true,
          userId: user.appUser._id,
        });
        return {
          interest: args.interest,
          program: yield* toLearningProgramSummary(program, args.locale),
        };
      })
    ),
});
