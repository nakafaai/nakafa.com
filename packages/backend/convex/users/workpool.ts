import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serializes every users-table patch so profile and credit updates never race. */
export const userWriteWorkpool = new Workpool(components.userWriteWorkpool, {
  maxParallelism: 1,
});
