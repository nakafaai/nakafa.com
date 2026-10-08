import contentStateTable from "@repo/backend/confect/_generated/tables/contentState";
import { Schema } from "effect";

const MaterialReadModelIdentitySchema = Schema.Struct({
  manifestHash: Schema.String,
  releaseId: Schema.String,
  sequence: Schema.Finite,
  state: contentStateTable.Fields,
});

type MaterialReadModelIdentity = typeof MaterialReadModelIdentitySchema.Type;

/** Checks the material projection against one active release identity. */
export function hasMaterialReadModel(identity: MaterialReadModelIdentity) {
  const { manifestHash, releaseId, sequence, state } = identity;
  return (
    state.materialManifestHash === manifestHash &&
    state.materialReleaseId === releaseId &&
    state.materialSequence === sequence
  );
}
