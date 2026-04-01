import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serializes notification preference, mute, and unread-count writes. */
export const notificationWorkpool = new Workpool(
  components.notificationWorkpool,
  {
    maxParallelism: 1,
  }
);
