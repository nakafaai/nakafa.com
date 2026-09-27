import { Table } from "@confect/core";
import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import { compactionPhaseValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    activeManifestHash: Schema.optionalKey(Schema.String),
    activeReleaseId: Schema.optionalKey(Schema.String),
    activeSequence: Schema.optionalKey(Schema.Finite),
    articleManifestHash: Schema.optionalKey(Schema.String),
    articleReleaseId: Schema.optionalKey(Schema.String),
    articleSequence: Schema.optionalKey(Schema.Finite),
    articleSlot: modelSlotValidator,
    candidateManifestHash: Schema.optionalKey(Schema.String),
    candidateReleaseId: Schema.optionalKey(Schema.String),
    candidateSequence: Schema.optionalKey(Schema.Finite),
    compactCursor: Schema.optionalKey(Schema.String),
    compactFloor: Schema.optionalKey(Schema.Finite),
    compactFrom: Schema.optionalKey(Schema.Finite),
    compactPhase: Schema.optionalKey(compactionPhaseValidator),
    compactStartedAt: Schema.optionalKey(Schema.Finite),
    compactedFloor: Schema.optionalKey(Schema.Finite),
    key: Schema.Literal("primary"),
    materialManifestHash: Schema.optionalKey(Schema.String),
    materialReleaseId: Schema.optionalKey(Schema.String),
    materialSequence: Schema.optionalKey(Schema.Finite),
    materialSlot: modelSlotValidator,
    nextSequence: Schema.Finite,
    recoveryManifestHash: Schema.optionalKey(Schema.String),
    recoveryReleaseId: Schema.optionalKey(Schema.String),
    recoverySequence: Schema.optionalKey(Schema.Finite),
    searchManifestHash: Schema.optionalKey(Schema.String),
    searchReleaseId: Schema.optionalKey(Schema.String),
    searchSequence: Schema.optionalKey(Schema.Finite),
    searchSlot: modelSlotValidator,
    updatedAt: Schema.Finite,
  })
).index("by_key", ["key"]);
