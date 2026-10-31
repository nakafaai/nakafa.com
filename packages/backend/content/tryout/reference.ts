import { identityCollision } from "@repo/backend/confect/contentRelease/error";
import type { ActiveContentReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { buildContentSearchDocument } from "@repo/backend/confect/contents/search/documents";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import {
  readCatalogByAsset,
  readCatalogEntry,
} from "@repo/backend/confect/tryouts/catalog/rows";
import { Effect, Option } from "effect";

/** Reads the stored catalog rows one reference names: the row at its route, or the rows of its asset. */
const readReferenceEntries = Effect.fn(
  "contentRelease.readTryoutReferenceRows"
)(function* (snapshotId: string, input: ActiveContentReferenceInput) {
  if (input.kind === "route") {
    return Option.toArray(
      yield* readCatalogEntry(snapshotId, input.appLocale, input.publicPath)
    );
  }
  return yield* readCatalogByAsset(
    snapshotId,
    input.appLocale,
    input.contentId
  );
});

/**
 * Resolves one public try-out entry of the active release that a reference names, as a search
 * document. A reference that names no public row has none, and one that names two is a collision.
 */
export const readTryoutReference = Effect.fn(
  "contentRelease.readTryoutReference"
)(function* (input: ActiveContentReferenceInput) {
  const { snapshotId } = yield* loadActiveAssessment();
  const entries = yield* readReferenceEntries(snapshotId, input);
  if (entries.length > 1) {
    return yield* identityCollision("try-out");
  }
  const [entry] = entries;
  const publicPath = entry?.row.publicPath;
  if (entry === undefined || publicPath === undefined) {
    return null;
  }
  const { row } = entry;
  return buildContentSearchDocument({
    ...row.graph,
    contentHash: entry.rowHash,
    ...(row.description === undefined ? {} : { description: row.description }),
    hasMarkdownSource: false,
    locale: input.publicLocale,
    route: publicPath,
    section: "tryout",
    sourcePath: publicPath,
    syncedAt: entry.index,
    text: "",
    title: row.title,
  });
});
