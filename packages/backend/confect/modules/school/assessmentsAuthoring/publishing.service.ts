import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Clock, Effect } from "effect";

/**
 * Publishes a scheduled assessment only when the current schedule is due.
 *
 * @see https://confect.dev/server/scheduling
 */
export const publishAssessment = Effect.fn("assessments.publishAssessment")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly publishedBy: Id<"users">;
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const assessment = yield* reader
      .table("schoolAssessments")
      .get(args.assessmentId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    const now = yield* Clock.currentTimeMillis;

    if (
      !assessment ||
      assessment.status !== "scheduled" ||
      !assessment.scheduledAt ||
      assessment.scheduledAt > now
    ) {
      return null;
    }

    yield* writer.table("schoolAssessments").patch(args.assessmentId, {
      publishedAt: now,
      publishedBy: args.publishedBy,
      scheduledAt: undefined,
      scheduledJobId: undefined,
      status: "published",
      updatedAt: now,
      updatedBy: args.publishedBy,
    });

    return null;
  }
);
