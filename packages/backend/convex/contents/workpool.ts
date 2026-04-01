import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serializes content analytics drains so sealed event batches never overlap. */
export const contentAnalyticsWorkpool = new Workpool(
  components.contentAnalyticsWorkpool,
  {
    maxParallelism: 1,
  }
);
