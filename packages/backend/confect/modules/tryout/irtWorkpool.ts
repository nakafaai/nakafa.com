import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serializes calibration sync mutations to avoid duplicate cache writes. */
export const irtCalibrationSyncWorkpool = new Workpool(
  components.irtCalibrationSyncWorkpool,
  {
    maxParallelism: 1,
  }
);

/** Serializes scale publication requests per calibration completion. */
export const irtScalePublicationQueueWorkpool = new Workpool(
  components.irtScalePublicationQueueWorkpool,
  {
    maxParallelism: 1,
  }
);
