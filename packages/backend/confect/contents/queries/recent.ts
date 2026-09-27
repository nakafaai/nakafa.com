import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { toLearningContextQuery } from "@repo/backend/confect/contents/context";
import { buildContentSearchRef } from "@repo/backend/confect/contents/helpers/search/documents";
import {
  getRecentlyViewedArgs,
  RecentLearningIoError,
  recentLearningIoFailedCode,
} from "@repo/backend/confect/contents/queries/recent.spec";
import { resolveLearningContext } from "@repo/backend/confect/contents/views/context";
import { hydrateMaterialTarget } from "@repo/backend/confect/contents/views/target";
import type { recentlyViewedSubjectValidator } from "@repo/backend/confect/lib/validators/trending";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, flow, Schema, Struct } from "effect";
export type RecentlyViewedSubject = Schema.Schema.Type<
  typeof recentlyViewedSubjectValidator
>;
export const defaultRecentLearningLimit = 5;
export const maxRecentLearningLimit = 20;
export const recentLearningCandidateLimit = 100;

/** Convex validator for bounded Continue Learning query inputs. */
/** Validator-owned argument contract used by the internal query program. */
export const getRecentlyViewedArgsValidator = Schema.Struct(
  getRecentlyViewedArgs
);
export type ListRecentLearningArgs = Schema.Schema.Type<
  typeof getRecentlyViewedArgsValidator
>;
/** Maps thrown Convex IO failures into the Continue Learning error channel. */
export function toRecentLearningIoError(error: unknown) {
  return new RecentLearningIoError({
    code: recentLearningIoFailedCode,
    cause: error,
    message: "Unable to load recent learning activity.",
  });
}

/** Reads the authenticated learner's ranked Continue Learning rows. */
export const listRecentLearning = Effect.fn(
  "contents.recent.listRecentLearning"
)(
  function* (ctx: QueryCtx, args: ListRecentLearningArgs) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const rawLimit = args.limit ?? defaultRecentLearningLimit;
    const limit = Math.min(Math.max(rawLimit, 0), maxRecentLearningLimit);
    const user = yield* getOptionalAppUserForRead(ctx).pipe(
      Effect.mapError(toRecentLearningIoError)
    );
    if (!(user && limit > 0)) {
      return [];
    }
    const subjects: RecentlyViewedSubject[] = [];
    const recentRows = yield* database
      .table("userLearningRecents")
      .index(
        "by_userId_and_locale_and_section_and_lastViewedAt",
        (q) =>
          q
            .eq("userId", user.appUser._id)
            .eq("locale", args.locale)
            .eq("section", "material"),
        "desc"
      )
      .take(recentLearningCandidateLimit)
      .pipe(Effect.orDie);
    for (const row of recentRows) {
      const subject = yield* toRecentlyViewedSubject(ctx, row);
      if (subject) {
        subjects.push(subject);
      }
      if (subjects.length >= limit) {
        break;
      }
    }
    return subjects;
  },
  Effect.catchDefect(flow(toRecentLearningIoError, Effect.fail))
);

/** Projects one ranked recent row to the public home-card result shape. */
export const toRecentlyViewedSubject = Effect.fn(
  "contents.recent.toRecentlyViewedSubject"
)(function* (ctx: QueryCtx, row: Doc<"userLearningRecents">) {
  const route = yield* hydrateMaterialTarget(ctx, {
    contentId: row.content_id,
    locale: row.locale,
  });
  if (!route) {
    return;
  }
  const context = yield* resolveLearningContext(
    ctx,
    route,
    row.contextMode === "placement"
      ? {
          mode: "placement",
          ...Struct.renameKeys(
            Struct.pick(row, ["contextNodeKey", "contextProgramKey"]),
            { contextNodeKey: "nodeKey", contextProgramKey: "programKey" }
          ),
        }
      : undefined
  );
  return {
    ...Struct.omit(buildContentSearchRef(route, true), ["sourcePath"]),
    contextKey: context.contextKey,
    description: route.description ?? "",
    href: `/${cleanSlug(route.route)}${toLearningContextQuery(context)}`,
    lastViewedAt: row.lastViewedAt,
    materialDomain: route.materialDomain,
    title: route.title,
  };
}, Effect.mapError(toRecentLearningIoError));
