import type { Doc } from "@repo/backend/convex/_generated/dataModel";

interface MaterialReadModelIdentity {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly sequence: number;
  readonly state: Doc<"contentState">;
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
