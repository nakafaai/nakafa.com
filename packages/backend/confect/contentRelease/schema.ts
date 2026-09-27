import { Schema } from "effect";
export const releaseProgress = {
  checkedIndex: Schema.Finite,
  checkedItems: Schema.Finite,
  stagedArtifacts: Schema.Finite,
  stagedDeletes: Schema.Finite,
  stagedItems: Schema.Finite,
  stagedProjections: Schema.Finite,
  stagedRoutes: Schema.Finite,
  stagedSnapshotBatches: Schema.Finite,
  stagedSnapshotRows: Schema.Finite,
  stagedUpserts: Schema.Finite,
};
