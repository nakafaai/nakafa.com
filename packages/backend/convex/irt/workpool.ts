import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

export const irtCalibrationSyncWorkpool = new Workpool(
  components.irtCalibrationSyncWorkpool,
  {
    maxParallelism: 1,
  }
);
