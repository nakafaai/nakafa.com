import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";

export const RETAINED_TRYOUT_SNAPSHOT_ID = Sha256HashSchema.make(
  "sha256:0a43a4125fc4886f90b5a509405178bfb8762ad3c7f72be80614fce2671b5162"
);

export const RETAINED_TRYOUT_RELEASE_COUNTS = {
  "full-corpus-runtime-v011-20260809-16a7436": 6,
  "quran-tryout-cutover-20260804-a48d644": 15,
};

export const RETAINED_TRYOUT_ATTEMPT_COUNT = 21;
export const RETAINED_TRYOUT_PROGRESS_COUNT = 10;
export const TRYOUT_HISTORY_CUTOVER_BATCH_SIZE = 25;
