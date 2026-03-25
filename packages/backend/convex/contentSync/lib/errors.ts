import { ConvexError } from "convex/values";

export const assertContentSyncBatchSize = (args: {
  functionName: string;
  limit: number;
  received: number;
  unit: string;
}) => {
  if (args.received <= args.limit) {
    return;
  }

  throw new ConvexError({
    code: "CONTENT_SYNC_BATCH_TOO_LARGE",
    message: `${args.functionName} received ${args.received} ${args.unit}, which exceeds the safe limit of ${args.limit}.`,
  });
};
