import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/convex/contentRelease/tryout/set";
import {
  getActiveTryoutSet,
  requireActiveReadyTryoutSet,
} from "@repo/backend/convex/tryouts/read";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

type FilesystemSection = Doc<"tryoutSections">;
type FilesystemSet = Doc<"tryoutSets">;

/** Filesystem rows used only before signed try-out ownership is activated. */
export interface FilesystemTryoutSource {
  readonly kind: "filesystem";
  readonly sections: readonly FilesystemSection[];
  readonly set: FilesystemSet;
}

/** Authenticated immutable rows used after signed ownership is activated. */
export interface SignedTryoutSource {
  readonly kind: "signed";
  /** Lookup-only key retained while the matching local shell still exists. */
  readonly retainedTryoutSetId?: FilesystemSet["_id"];
  readonly snapshot: VerifiedTryoutSet;
}

/** Placement source selected by the explicit publication ownership mode. */
export type TryoutSectionSource = FilesystemTryoutSource | SignedTryoutSource;

/** Explicit source selected from the active publication ownership state. */
export type TryoutStartSource = TryoutSectionSource;

/** Selects the complete filesystem or signed snapshot without cross-source joins. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (ctx: QueryCtx, args: StartAttemptArgs) {
  const owner = yield* loadTryoutOwner(ctx).pipe(
    Effect.mapError(toTryoutStartError)
  );
  if (owner.managed) {
    const [snapshot, retainedSet] = yield* Effect.all([
      readTryoutSet(ctx, args).pipe(Effect.mapError(toTryoutStartError)),
      tryStartPromise(() => getActiveTryoutSet(ctx, args)),
    ]);
    const source: TryoutStartSource = {
      kind: "signed",
      ...(retainedSet ? { retainedTryoutSetId: retainedSet._id } : {}),
      snapshot,
    };
    return source;
  }

  const set = yield* tryStartPromise(() =>
    requireActiveReadyTryoutSet(ctx, args)
  );
  const sections = yield* loadFilesystemSections(ctx, set);
  const source: TryoutStartSource = { kind: "filesystem", sections, set };
  return source;
});

/** Loads and validates ordered filesystem sections before signed activation. */
const loadFilesystemSections = Effect.fn(
  "tryouts.start.loadFilesystemSections"
)(function* (ctx: QueryCtx, set: FilesystemSet) {
  const sections = yield* tryStartPromise(() =>
    ctx.db
      .query("tryoutSections")
      .withIndex("by_tryoutSetId_and_order", (query) =>
        query.eq("tryoutSetId", set._id)
      )
      .take(set.sectionCount + 1)
  );

  if (sections.length !== set.sectionCount) {
    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.sectionCountMismatch,
      message: "Try-out set section count is not synced.",
    });
  }

  const questionCount = sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
  const hasMixedRevision = sections.some(
    (section) => section.sourceRevision !== set.sourceRevision
  );
  if (questionCount !== set.totalQuestionCount || hasMixedRevision) {
    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.sectionSnapshotMismatch,
      message: "Try-out set sections are not fully synced.",
    });
  }

  return sections;
});

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
