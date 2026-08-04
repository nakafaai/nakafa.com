import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  publicTryoutExamValidator,
  publicTryoutQuestionContentValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import {
  readAttemptSectionPage,
  readAttemptSetPage,
} from "@repo/backend/convex/tryouts/queries/retained/page";
import { v } from "convex/values";

const setPageFields = {
  exam: publicTryoutExamValidator,
  entryQuestions: v.array(publicTryoutQuestionContentValidator),
  entrySection: v.union(publicTryoutSectionValidator, v.null()),
  set: publicTryoutSetValidator,
  sections: v.array(publicTryoutSectionValidator),
  track: publicTryoutTrackValidator,
};
const sectionPageFields = {
  exam: publicTryoutExamValidator,
  questions: v.array(publicTryoutQuestionContentValidator),
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
};

/** Reads one owned set from the user's exact frozen attempt snapshot. */
export const getAttemptSetPage = query({
  args: {
    attemptId: v.optional(v.string()),
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      activeSetPublicPath: v.union(v.string(), v.null()),
      attemptId: v.id("tryoutAttempts"),
      page: v.object(setPageFields),
    })
  ),
  handler: (ctx, args) => runConvexProgram(readAttemptSetPage(ctx, args)),
});

/** Reads one owned section from the user's frozen attempt snapshot. */
export const getAttemptSectionPage = query({
  args: {
    attemptId: v.optional(v.string()),
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      activeSectionPublicPath: v.union(v.string(), v.null()),
      activeSetPublicPath: v.union(v.string(), v.null()),
      attemptId: v.id("tryoutAttempts"),
      page: v.object(sectionPageFields),
    })
  ),
  handler: (ctx, args) => runConvexProgram(readAttemptSectionPage(ctx, args)),
});
