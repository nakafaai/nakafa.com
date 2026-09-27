import { Table } from "@confect/core";
import {
  appLocaleValidator,
  artifactLocaleValidator,
  deliveryLanguageValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    answerArtifactHash: Schema.String,
    answerArtifactLocale: artifactLocaleValidator,
    appLocale: appLocaleValidator,
    contentHash: Schema.String,
    countryKey: Schema.String,
    deliveryLanguage: deliveryLanguageValidator,
    examKey: Schema.String,
    identity: Schema.String,
    index: Schema.Finite,
    questionArtifactHash: Schema.String,
    questionArtifactLocale: artifactLocaleValidator,
    questionOrder: Schema.Finite,
    rowHash: Schema.String,
    rowJson: Schema.String,
    snapshotId: Schema.String,
    sectionKey: Schema.String,
    setKey: Schema.String,
    trackKey: Schema.String,
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
  .index("by_snapshotId_and_appLocale_and_section_and_questionOrder", [
    "snapshotId",
    "appLocale",
    "countryKey",
    "examKey",
    "trackKey",
    "setKey",
    "sectionKey",
    "questionOrder",
  ])
  .index("by_snapshotId_and_questionArtifactHash", [
    "snapshotId",
    "questionArtifactHash",
  ])
  .index("by_snapshotId_and_answerArtifactHash", [
    "snapshotId",
    "answerArtifactHash",
  ])
  .index("by_questionArtifactHash", ["questionArtifactHash"])
  .index("by_answerArtifactHash", ["answerArtifactHash"]);
