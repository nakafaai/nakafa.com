import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serialize calibration cache sync work to avoid conflicting writes. */
export const irtCalibrationSyncWorkpool = new Workpool(
  components.irtCalibrationSyncWorkpool,
  {
    maxParallelism: 1,
  }
);

/** Serialize scale-publication queue writes to avoid duplicate queue rows. */
export const irtScalePublicationQueueWorkpool = new Workpool(
  components.irtScalePublicationQueueWorkpool,
  {
    maxParallelism: 1,
  }
);

/** Serialize scale-quality refresh work to avoid conflicting writes. */
export const irtScaleQualityRefreshWorkpool = new Workpool(
  components.irtScaleQualityRefreshWorkpool,
  {
    maxParallelism: 1,
  }
);
