import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  publicTryoutExamValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import {
  resolveAttemptSectionRoute,
  resolveAttemptSetRoute,
} from "@repo/backend/convex/tryouts/queries/retained/page";
import { readOwnedTryoutSectionContent } from "@repo/backend/convex/tryouts/runtime/access";
import {
  type TryoutSectionContentAccess,
  tryoutSectionContentAccessValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { v } from "convex/values";
import { Effect } from "effect";

const setPageFields = {
  exam: publicTryoutExamValidator,
  entrySection: v.union(publicTryoutSectionValidator, v.null()),
  set: publicTryoutSetValidator,
  sections: v.array(publicTryoutSectionValidator),
  track: publicTryoutTrackValidator,
};
const sectionPageFields = {
  exam: publicTryoutExamValidator,
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
};

const noContentAccess: Extract<TryoutSectionContentAccess, { kind: "none" }> = {
  kind: "none",
};

/** Reads one owned set and entry content from the exact frozen attempt. */
export const getAttemptSetRoute = query({
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
      content: tryoutSectionContentAccessValidator,
      page: v.object(setPageFields),
    })
  ),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const resolved = yield* resolveAttemptSetRoute(ctx, args);
        if (!resolved) {
          return null;
        }
        const entrySection = resolved.route.page.entrySection;
        if (entrySection?.visibility !== "internal-entry") {
          return { ...resolved.route, content: noContentAccess };
        }
        const content = yield* readOwnedTryoutSectionContent(ctx, {
          attempt: resolved.attempt,
          locale: args.locale,
          sectionKey: entrySection.sectionKey,
        });
        return { ...resolved.route, content };
      })
    ),
});

/** Reads one owned section and content from the exact frozen attempt. */
export const getAttemptSectionRoute = query({
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
      content: tryoutSectionContentAccessValidator,
      page: v.object(sectionPageFields),
    })
  ),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const resolved = yield* resolveAttemptSectionRoute(ctx, args);
        if (!resolved) {
          return null;
        }
        const content = yield* readOwnedTryoutSectionContent(ctx, {
          attempt: resolved.attempt,
          locale: args.locale,
          sectionKey: resolved.route.page.section.sectionKey,
        });
        return { ...resolved.route, content };
      })
    ),
});
