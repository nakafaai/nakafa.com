import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
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
import { cleanSlug } from "@repo/utilities/helper";
import { Array as Arr, Effect, flow, Schema, Struct } from "effect";
export type RecentlyViewedSubject = typeof recentlyViewedSubjectValidator.Type;
const defaultRecentLearningLimit = 5;
const maxRecentLearningLimit = 20;
const recentLearningCandidateLimit = 100;

/** Convex validator for bounded Continue Learning query inputs. */
/** Validator-owned argument contract used by the internal query program. */
const getRecentlyViewedArgsValidator = Schema.Struct(getRecentlyViewedArgs);
type ListRecentLearningArgs = typeof getRecentlyViewedArgsValidator.Type;
/** Maps thrown Convex IO failures into the Continue Learning error channel. */
function toRecentLearningIoError(error: unknown) {
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
  function* (args: ListRecentLearningArgs) {
    const database = yield* DatabaseReader;
    const rawLimit = args.limit ?? defaultRecentLearningLimit;
    const limit = Math.min(Math.max(rawLimit, 0), maxRecentLearningLimit);
    const user = yield* getOptionalAppUserForRead().pipe(
      Effect.mapError(toRecentLearningIoError)
    );
    if (!(user && limit > 0)) {
      return [];
    }
    let subjects: RecentlyViewedSubject[] = [];
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
      const subject = yield* toRecentlyViewedSubject(row);
      if (subject) {
        subjects = Arr.append(subjects, subject);
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
const toRecentlyViewedSubject = Effect.fn(
  "contents.recent.toRecentlyViewedSubject"
)(function* (row: Docs["userLearningRecents"]) {
  const route = yield* hydrateMaterialTarget({
    contentId: row.content_id,
    locale: row.locale,
  });
  if (!route) {
    return;
  }
  const context = yield* resolveLearningContext(
    route,
    row.contextMode === "placement"
      ? {
          mode: "placement",
          ...Struct.renameKeys(
            Struct.pick(row, ["contextNodeKey", "contextProgramKey"]),
            {
              contextNodeKey: "nodeKey",
              contextProgramKey: "programKey",
            }
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
