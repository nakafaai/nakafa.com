import { canonicalizeSignedContentArtifact } from "@nakafa/aksara-contracts/content";
import {
  ContentProjectionSchema as CurrentProjectionSchema,
  canonicalizeContentProjection as canonicalizeCurrentProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { canonicalizeContentChange } from "@nakafa/aksara-contracts/release/canonical";
import {
  MAX_ROLLBACK_PAGE_RECORDS,
  RollbackDeleteStateSchema,
  RollbackPageSchema as CurrentPageSchema,
  RollbackRecordSchema as CurrentRecordSchema,
  RollbackSnapshotEntrySchema as CurrentSnapshotEntrySchema,
  RollbackUpsertStateSchema as CurrentUpsertStateSchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import {
  ContentProjectionSchema as PredecessorProjectionSchema,
  canonicalizeContentProjection as canonicalizePredecessorProjection,
} from "@nakafa/aksara-v150/projection/spec";
import {
  RollbackSnapshotEntrySchema as PredecessorSnapshotEntrySchema,
  RollbackUpsertStateSchema as PredecessorUpsertStateSchema,
} from "@nakafa/aksara-v150/release/rollback/spec";
import { Schema } from "effect";

/** Authenticated projections that can still exist in immutable rollback data. */
export const StoredProjectionSchema = Schema.Union([
  CurrentProjectionSchema,
  PredecessorProjectionSchema,
]);
export type StoredProjection = typeof StoredProjectionSchema.Type;

/** Immutable prior-state entries admitted by the two exact storage contracts. */
export const StoredSnapshotEntrySchema = Schema.Union([
  CurrentSnapshotEntrySchema,
  PredecessorSnapshotEntrySchema,
]);

/** Body-bearing rollback states admitted by the two exact storage contracts. */
export const StoredUpsertStateSchema = Schema.Union([
  CurrentUpsertStateSchema,
  PredecessorUpsertStateSchema,
]);
export type StoredUpsertState = typeof StoredUpsertStateSchema.Type;

/** Complete immutable rollback state. */
export const StoredStateSchema = Schema.Union([
  StoredUpsertStateSchema,
  RollbackDeleteStateSchema,
]);

/** Complete immutable transition with exact current or predecessor bodies. */
export const StoredRecordSchema = CurrentRecordSchema.mapFields(
  (fields) => ({
    ...fields,
    current: StoredStateSchema,
    prior: StoredStateSchema,
  }),
  { unsafePreserveChecks: true }
);
export type StoredRecord = typeof StoredRecordSchema.Type;
export type StoredState = StoredRecord["current"];
export type StoredUpsert = Extract<
  StoredState,
  { readonly change: { readonly operation: "upsert" } }
>;

/** Bounded pages admitted from immutable rollback storage. */
export const StoredPageSchema = CurrentPageSchema.mapFields(
  (fields) => ({
    ...fields,
    records: Schema.Array(StoredRecordSchema).pipe(
      Schema.check(Schema.isMaxLength(MAX_ROLLBACK_PAGE_RECORDS))
    ),
  }),
  { unsafePreserveChecks: true }
);
export type StoredPage = typeof StoredPageSchema.Type;

/** Canonicalizes an authenticated projection with the contract that decoded it. */
export function canonicalizeStoredProjection(projection: StoredProjection) {
  if (Schema.is(CurrentProjectionSchema)(projection)) {
    return canonicalizeCurrentProjection(projection);
  }
  return canonicalizePredecessorProjection(projection);
}

/** Canonicalizes one immutable rollback transition. */
export function canonicalizeStoredRecord(record: StoredRecord) {
  return `{"current":${canonicalizeStoredState(record.current)},"index":${record.index},"prior":${canonicalizeStoredState(record.prior)}}`;
}

/** Canonicalizes one immutable rollback page. */
export function canonicalizeStoredPage(page: StoredPage) {
  return `{"done":${page.done},"nextIndex":${page.nextIndex},"records":[${page.records
    .map(canonicalizeStoredRecord)
    .join(
      ","
    )}],"rollbackOfManifestHash":${JSON.stringify(page.rollbackOfManifestHash)},"rollbackOf":${JSON.stringify(page.rollbackOf)},"total":${page.total}}`;
}

/** Narrows one stored state to its signed body-bearing variant. */
export function isStoredUpsert(
  state: StoredState
): state is StoredUpsert {
  return "artifact" in state;
}

/** Serializes one authenticated state in stable field order. */
function canonicalizeStoredState(state: StoredState) {
  const change = JSON.stringify(canonicalizeContentChange(state.change));
  if (!isStoredUpsert(state)) {
    return `{"change":${change}}`;
  }
  return `{"artifact":${canonicalizeSignedContentArtifact(state.artifact)},"change":${change},"projection":${canonicalizeStoredProjection(state.projection)}}`;
}
