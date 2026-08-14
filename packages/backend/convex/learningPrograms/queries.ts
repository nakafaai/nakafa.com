import { query } from "@repo/backend/convex/_generated/server";
import { readLearningPreferenceByUserId } from "@repo/backend/convex/learningPreferences/impl";
import {
  isLearningProgramSelectable,
  listSignedPrograms,
  readSignedProgram,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/selection";
import {
  activeLearningSelectionValidator,
  learningProgramSummaryValidator,
  programMatchesInterest,
} from "@repo/backend/convex/learningPrograms/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { Effect } from "effect";

/** Returns the current user's canonical signed learning selection. */
export const getActiveSelection = query({
  args: {
    locale: localeValidator,
  },
  returns: activeLearningSelectionValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* Effect.promise(() =>
          getOptionalAppUserForRead(ctx)
        );

        if (!user) {
          return null;
        }

        const preference = yield* readLearningPreferenceByUserId(
          ctx,
          user.appUser._id
        );

        if (!(preference?.learningInterest && preference.primaryProgramKey)) {
          return null;
        }

        const program = yield* readSignedProgram(
          ctx,
          args.locale,
          preference.primaryProgramKey
        );

        if (
          !(
            program &&
            isLearningProgramSelectable(program) &&
            programMatchesInterest(program.kind, preference.learningInterest)
          )
        ) {
          return null;
        }

        return {
          interest: preference.learningInterest,
          program: yield* toLearningProgramSummary(program, args.locale),
        };
      })
    ),
});

/** Lists selectable learning programs from the current signed snapshot. */
export const listSelectablePrograms = query({
  args: {
    locale: localeValidator,
  },
  returns: v.array(learningProgramSummaryValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      listSignedPrograms(ctx, args.locale).pipe(
        Effect.flatMap((programs) =>
          Effect.forEach(
            programs.filter(isLearningProgramSelectable),
            (program) => toLearningProgramSummary(program, args.locale)
          )
        )
      )
    ),
});
