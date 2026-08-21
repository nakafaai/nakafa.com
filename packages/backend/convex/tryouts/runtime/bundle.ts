import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { Effect, Schema } from "effect";
/** Exact signed release and renderer retained for one attempt generation. */
export interface TryoutBundleSource {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly releaseJson: string;
  readonly rendererJson: string;
  readonly snapshotId: string;
}
/** Expected failure while retaining one immutable try-out runtime bundle. */
export class TryoutBundleError extends Schema.TaggedError<TryoutBundleError>()(
  "TryoutBundleError",
  {
    code: Schema.Literals([
      "TRYOUT_BUNDLE_CONFLICT",
      "TRYOUT_BUNDLE_READ_FAILED",
      "TRYOUT_BUNDLE_WRITE_FAILED",
    ]),
    message: Schema.String,
  }
) {}
type ReadCtx = MutationCtx | QueryCtx;
/** Reads one retained bundle through its globally unique release identity. */
export const findTryoutBundleByRelease = Effect.fn(
  "tryouts.runtime.findTryoutBundleByRelease"
)(function* (ctx: ReadCtx, releaseId: string) {
  return yield* tryBundlePromise(
    "TRYOUT_BUNDLE_READ_FAILED",
    "Unable to read the retained try-out runtime bundle.",
    () =>
      ctx.db
        .query("tryoutBundles")
        .withIndex("by_releaseId", (index) => index.eq("releaseId", releaseId))
        .unique()
  );
});
/** Stores or reuses one exact release bundle before an attempt references it. */
export const retainTryoutBundle = Effect.fn(
  "tryouts.runtime.retainTryoutBundle"
)(function* (ctx: MutationCtx, source: TryoutBundleSource, createdAt: number) {
  const stored = yield* findTryoutBundleByRelease(ctx, source.releaseId);
  if (stored) {
    yield* verifyStoredBundle(stored, source);
    return stored._id;
  }
  const latest = yield* tryBundlePromise(
    "TRYOUT_BUNDLE_READ_FAILED",
    "Unable to read the retained try-out runtime bundle.",
    () =>
      ctx.db
        .query("tryoutBundles")
        .withIndex("by_snapshotId_and_index", (index) =>
          index.eq("snapshotId", source.snapshotId)
        )
        .order("desc")
        .first()
  );
  const row = {
    ...source,
    createdAt,
    index: (latest?.index ?? -1) + 1,
  };
  yield* ensureDocumentSize(
    `Try-out runtime bundle ${source.snapshotId}/${source.releaseId}`,
    row
  ).pipe(
    Effect.mapError(
      (error) =>
        new TryoutBundleError({
          code: "TRYOUT_BUNDLE_WRITE_FAILED",
          message: error.message,
        })
    )
  );
  return yield* tryBundlePromise(
    "TRYOUT_BUNDLE_WRITE_FAILED",
    "Unable to retain the try-out runtime bundle.",
    () => ctx.db.insert("tryoutBundles", row)
  );
});
/** Rejects reuse of one release identity with different signed bytes. */
const verifyStoredBundle = Effect.fn("tryouts.runtime.verifyStoredBundle")(
  function* (stored: Doc<"tryoutBundles">, source: TryoutBundleSource) {
    if (
      stored.manifestHash === source.manifestHash &&
      stored.snapshotId === source.snapshotId &&
      stored.releaseJson === source.releaseJson &&
      stored.rendererJson === source.rendererJson
    ) {
      return;
    }
    return yield* new TryoutBundleError({
      code: "TRYOUT_BUNDLE_CONFLICT",
      message:
        "Try-out runtime bundle identity was reused with different bytes.",
    });
  }
);
/** Lifts one bundle storage operation into its typed failure channel. */
function tryBundlePromise<A>(
  code: TryoutBundleError["code"],
  message: string,
  operation: () => Promise<A>
) {
  return Effect.tryPromise({
    catch: () =>
      new TryoutBundleError({
        code,
        message,
      }),
    try: operation,
  });
}
