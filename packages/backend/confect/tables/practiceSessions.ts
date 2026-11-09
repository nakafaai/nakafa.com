import { Table } from "@confect/core";
import { PaperIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";

/**
 * One learner's practice of one section of a set (ADR 0044): untimed, checked question by question, and
 * never scored or calibrated. A learner holds one per set and section, which resumes where it stopped and
 * starts again on request. Its questions stand in `practiceQuestions`, frozen from the snapshot it names,
 * which retention keeps while a session names it.
 */
export default Table.make(() =>
  Schema.Struct({
    userId: IdSchema("users"),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    sectionKey: tryoutRouteKeyValidator,
    appLocale: appLocaleValidator,
    /** The assessment snapshot and the release the questions were frozen from. */
    assessmentSnapshotId: Schema.String,
    releaseId: Schema.String,
    paper: Schema.Struct({ hash: Sha256HashSchema, id: PaperIdSchema }),
    questionCount: Schema.Finite,
    startedAt: Schema.Finite,
    lastActivityAt: Schema.Finite,
  })
)
  .index("by_userId_and_set_and_sectionKey", [
    "userId",
    "countryKey",
    "examKey",
    "trackKey",
    "setKey",
    "sectionKey",
  ])
  .index("by_assessmentSnapshotId", ["assessmentSnapshotId"]);
