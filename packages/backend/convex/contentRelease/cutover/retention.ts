import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type PaginationOptions, paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

interface RetainedArtifactRow {
  readonly answerArtifactJson: string;
  readonly questionArtifactJson: string;
  readonly rowHash: string;
  readonly rowJson: string;
}

const retainedArtifactRowValidator = v.object({
  answerArtifactJson: v.string(),
  questionArtifactJson: v.string(),
  rowHash: v.string(),
  rowJson: v.string(),
});
const artifactReferencePageValidator = v.object({
  cursor: v.string(),
  done: v.boolean(),
  rows: v.array(retainedArtifactRowValidator),
});
const retainedBundleValidator = v.object({
  manifestHash: v.string(),
  releaseId: v.string(),
  releaseJson: v.string(),
  rendererJson: v.string(),
  snapshotId: v.string(),
});

/** Proves one bounded history page still owns both exact artifact documents. */
export const artifactPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    snapshotId: v.string(),
  },
  returns: artifactReferencePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readArtifactReferencePage(ctx, args.snapshotId, args.paginationOpts)
    ),
});

/** Reads the exact signed bundle used to authenticate retained artifacts. */
export const retainedBundle = internalQuery({
  args: { releaseId: v.string() },
  returns: retainedBundleValidator,
  handler: (ctx, args) =>
    runConvexProgram(readRetainedBundle(ctx, args.releaseId)),
});

/** Returns bounded immutable bytes for complete artifact authentication. */
const readArtifactReferencePage = Effect.fn(
  "contentRelease.cutover.readArtifactReferencePage"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  paginationOpts: PaginationOptions
) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryRows")
      .withIndex("by_snapshotId_and_rowKind_and_index", (index) =>
        index.eq("snapshotId", snapshotId).eq("rowKind", "placement")
      )
      .paginate(paginationOpts)
  );
  const rows: RetainedArtifactRow[] = [];
  for (const row of page.page) {
    if (row.rowKind !== "placement") {
      return yield* retentionFailure("Catalog row entered placement history.");
    }
    const [answer, question] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (index) =>
            index.eq("artifactHash", row.answerArtifactHash)
          )
          .unique()
      ),
      Effect.promise(() =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (index) =>
            index.eq("artifactHash", row.questionArtifactHash)
          )
          .unique()
      ),
    ]);
    if (!(answer && question)) {
      return yield* retentionFailure(
        `History placement ${row.rowHash} lost an artifact.`
      );
    }
    rows.push({
      answerArtifactJson: answer.artifactJson,
      questionArtifactJson: question.artifactJson,
      rowHash: row.rowHash,
      rowJson: row.rowJson,
    });
  }
  return {
    cursor: page.continueCursor,
    done: page.isDone,
    rows,
  };
});

/** Loads one exact bundle already bound to the retained snapshot plan. */
const readRetainedBundle = Effect.fn(
  "contentRelease.cutover.readRetainedBundle"
)(function* (ctx: QueryCtx, releaseId: string) {
  const bundle = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutBundles")
      .withIndex("by_releaseId", (index) => index.eq("releaseId", releaseId))
      .unique()
  );
  if (!bundle) {
    return yield* retentionFailure(`Retained bundle ${releaseId} is missing.`);
  }
  return {
    manifestHash: bundle.manifestHash,
    releaseId: bundle.releaseId,
    releaseJson: bundle.releaseJson,
    rendererJson: bundle.rendererJson,
    snapshotId: bundle.snapshotId,
  };
});

function retentionFailure(message: string) {
  return Effect.fail(
    new ReleaseError({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: `Cutover retention proof: ${message}`,
    })
  );
}
