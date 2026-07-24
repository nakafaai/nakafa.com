/** Signed placement identity required by one provisional IRT item. */
export interface IrtSyncPlacementProof {
  readonly placementIdentity: string;
  readonly placementRowHash: string;
  readonly questionSourceKey: string;
}

/** Signed section identity and placements required by one calibration run. */
export interface IrtSyncSectionProof {
  readonly placements: readonly IrtSyncPlacementProof[];
  readonly sectionIdentity: string;
  readonly sectionKey: string;
}

/** Complete signed identity proof for one synchronized IRT set. */
export interface IrtSyncSetProof {
  readonly sections: readonly IrtSyncSectionProof[];
  readonly setIdentity: string;
  readonly snapshotId: string;
}

/** Bounded proof map resolved before a try-out sync transaction writes. */
export interface IrtSyncProof {
  readonly sets: readonly IrtSyncSetProof[];
}
