import { RESET_WORKFLOW_CONFIG } from "@repo/backend/convex/credits/constants";

/** Returns the fixed queue partition for one user id. */
export function getCreditResetQueuePartition(userId: string) {
  let partition = 0;

  for (const character of userId) {
    partition =
      (partition * 31 + character.charCodeAt(0)) %
      RESET_WORKFLOW_CONFIG.partitionCount;
  }

  return partition;
}
