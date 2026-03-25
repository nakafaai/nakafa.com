import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serialize calibration cache sync work to avoid conflicting writes. */
export const irtCalibrationSyncWorkpool = new Workpool(
  components.irtCalibrationSyncWorkpool,
  {
    maxParallelism: 1,
  }
);
