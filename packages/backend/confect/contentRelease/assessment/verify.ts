import type { Docs } from "@repo/backend/confect/_generated/docs";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

/** Authenticates one stored assessment row and every indexed fact. */
export const verifyAssessmentRow = Effect.fn(
  "contentRelease.verifyAssessmentRow"
)(function* (
  row: WithoutSystemFields<Docs["assessmentRows"]>,
  snapshotId: string
) {
  const decoded = yield* decodeSnapshotRowJson(row.rowJson);
  if (
    decoded.family !== "assessment" ||
    decoded.record.rowHash !== row.rowHash ||
    row.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Assessment row ${row.identity} lost its signed snapshot.`
    );
  }
  const facts = assessmentRowFacts(decoded.record.row);
  if (
    facts.appLocale !== row.appLocale ||
    facts.assetId !== row.assetId ||
    facts.identity !== row.identity ||
    facts.kind !== row.kind ||
    facts.language !== row.language ||
    facts.order !== row.order ||
    facts.publicPath !== row.publicPath ||
    facts.setIdentity !== row.setIdentity ||
    facts.versionHash !== row.versionHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Assessment row ${row.identity} changed its indexed facts.`
    );
  }
  return decoded.record.row;
});
