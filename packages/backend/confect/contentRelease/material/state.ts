import type { PublicationRow } from "@repo/backend/content/publication/source";

interface MaterialReadModelIdentity {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly sequence: number;
  readonly state: PublicationRow<"contentState">;
}

/** Checks the material projection against one active release identity. */
export function hasMaterialReadModel(identity: MaterialReadModelIdentity) {
  const { manifestHash, releaseId, sequence, state } = identity;
  return (
    state.materialManifestHash === manifestHash &&
    state.materialReleaseId === releaseId &&
    state.materialSequence === sequence
  );
}
