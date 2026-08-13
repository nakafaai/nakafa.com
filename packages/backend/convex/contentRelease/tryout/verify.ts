import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import {
  tryoutCatalogFacts,
  tryoutPlacementFacts,
} from "@repo/backend/convex/contentRelease/tryout/facts";
import { Effect } from "effect";

/** Authenticates one immutable catalog row and every indexed fact. */
export const verifyTryoutCatalog = Effect.fn(
  "contentRelease.verifyTryoutCatalog"
)(function* (row: Doc<"tryoutCatalog">, snapshotId: string) {
  const decoded = yield* decodeSnapshotRowJson(row.rowJson);
  if (
    decoded.family !== "tryout" ||
    decoded.rowKind !== "catalog" ||
    decoded.record.rowHash !== row.rowHash ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out catalog row ${row.identity} lost its signed snapshot.`
    );
  }
  const facts = tryoutCatalogFacts(decoded.record);
  if (
    (row.assetId !== undefined && facts.assetId !== row.assetId) ||
    facts.identity !== row.identity ||
    facts.kind !== row.kind ||
    facts.locale !== row.locale ||
    facts.order !== row.order ||
    facts.publicPath !== row.publicPath ||
    facts.setIdentity !== row.setIdentity
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out catalog row ${row.identity} changed its indexed facts.`
    );
  }
  return decoded.record.row;
});

/** Authenticates one server-only placement and every indexed fact. */
export const verifyTryoutPlacement = Effect.fn(
  "contentRelease.verifyTryoutPlacement"
)(function* (row: Doc<"tryoutPlacements">, snapshotId: string) {
  const decoded = yield* decodeSnapshotRowJson(row.rowJson);
  if (
    decoded.family !== "tryout" ||
    decoded.rowKind !== "placement" ||
    decoded.record.rowHash !== row.rowHash ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out placement ${row.identity} lost its signed snapshot.`
    );
  }
  const facts = tryoutPlacementFacts(decoded.record);
  if (
    facts.answerArtifactHash !== row.answerArtifactHash ||
    facts.contentHash !== row.contentHash ||
    facts.countryKey !== row.countryKey ||
    facts.examKey !== row.examKey ||
    facts.identity !== row.identity ||
    facts.locale !== row.locale ||
    facts.questionArtifactHash !== row.questionArtifactHash ||
    facts.questionOrder !== row.questionOrder ||
    facts.sectionKey !== row.sectionKey ||
    facts.setKey !== row.setKey ||
    facts.trackKey !== row.trackKey
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out placement ${row.identity} changed its indexed facts.`
    );
  }
  return decoded.record.row;
});
