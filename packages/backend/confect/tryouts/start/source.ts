import {
  CatalogSectionSchema,
  CatalogSetSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { PaperSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { ExamProfileSchema } from "@nakafa/aksara-contracts/assessment/profile";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { readCatalogSet } from "@repo/backend/confect/tryouts/catalog/rows";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import {
  readItemKey,
  readItemVersion,
  readPaper,
  readProfile,
} from "@repo/backend/confect/tryouts/rows";
import { PlacedItem } from "@repo/backend/confect/tryouts/start/freeze";
import type { StartAttemptArgs } from "@repo/backend/confect/tryouts/start/spec";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** What one attempt starts from in the active snapshot, as `loadTryoutStartSource` reads it. */
export const TryoutStartSource = Schema.Struct({
  active: Schema.Struct({
    releaseId: Schema.String,
    snapshotId: Schema.String,
  }),
  items: Schema.Array(PlacedItem),
  paper: Schema.Struct({ hash: Sha256HashSchema, paper: PaperSchema }),
  profile: Schema.Struct({
    hash: Sha256HashSchema,
    profile: ExamProfileSchema,
  }),
  sections: Schema.Array(CatalogSectionSchema),
  set: CatalogSetSchema,
  setIdentity: Schema.String,
});
export type TryoutStartSource = typeof TryoutStartSource.Type;

/**
 * Loads what one attempt starts from in the active snapshot: the set in the learner's app locale with
 * its sections, the paper it names and the profile the paper follows, each checked against the hash
 * that names it, and the item version and key of every place. `active` is the release the learner
 * sees, so a start always freezes the snapshot that release selected.
 */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (
  active: { readonly releaseId: string; readonly snapshotId: string },
  args: StartAttemptArgs
) {
  const setIdentity = tryoutSetIdentityOf(args);
  const found = yield* readCatalogSet(
    active.snapshotId,
    setIdentity,
    args.locale
  );
  if (Option.isNone(found)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `The active release publishes no set ${setIdentity} in ${args.locale}.`
    );
  }
  const { sections, set } = found.value;
  const paper = yield* readPaper(active.snapshotId, set.paper);
  const profile = yield* readProfile(active.snapshotId, paper.paper.profile);
  const items = yield* Effect.forEach(
    Arr.flatMap(paper.paper.sections, ({ placements }) => placements),
    ({ hash }) =>
      Effect.all({ key: readItemKey(hash), version: readItemVersion(hash) })
  );
  return {
    active,
    items,
    paper,
    profile,
    sections,
    set,
    setIdentity,
  } satisfies TryoutStartSource;
});
