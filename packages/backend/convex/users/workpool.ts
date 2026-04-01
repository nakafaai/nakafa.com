import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serializes users-table writes without mixing in unrelated domains. */
export const userWriteWorkpool = new Workpool(components.userWriteWorkpool, {
  maxParallelism: 1,
});
