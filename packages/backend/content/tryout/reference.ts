import { findTryoutOwner } from "@repo/backend/content/tryout/owner";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ActiveContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { Effect, Option } from "effect";

/** Resolves one exact public try-out entry from its active signed hierarchy. */
export const readTryoutReference = Effect.fn(
  "contentRelease.readTryoutReference"
)(function* (input: ActiveContentReferenceInput) {
  const owner = yield* findTryoutOwner();
  if (Option.isNone(owner)) {
    return null;
  }
  const { snapshotId } = owner.value;
  const rows = yield* readTryoutReferenceRows(snapshotId, input);
  if (rows.length > 1) {
    return yield* identityCollision("try-out");
  }
  const stored = rows[0];
  if (!stored) {
    return null;
  }
  const row = yield* verifyTryoutCatalog(stored, snapshotId);
  if (!row.publicPath) {
    return null;
  }
  return buildContentSearchDocument({
    ...row.graph,
    contentHash: stored.rowHash,
    description: row.description,
    hasMarkdownSource: false,
    locale: input.publicLocale,
    route: row.publicPath,
    section: "tryout",
    sourcePath: row.publicPath,
    syncedAt: stored.index,
    text: "",
    title: row.title,
  });
});

/** Selects exact public try-out candidates under one immutable snapshot. */
const readTryoutReferenceRows = Effect.fn(
  "contentRelease.readTryoutReferenceRows"
)(function* (snapshotId: string, input: ActiveContentReferenceInput) {
  const source = yield* TryoutSource;
  if (input.kind === "route") {
    return Option.toArray(
      yield* source.path(snapshotId, input.appLocale, input.publicPath)
    );
  }
  return yield* source.asset(snapshotId, input.appLocale, input.contentId, 2);
});
/** Rejects a semantic identity shared by multiple current catalog rows. */
function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
