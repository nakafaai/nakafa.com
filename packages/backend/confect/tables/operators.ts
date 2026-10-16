import { Table } from "@confect/core";
import { operatorValidator } from "@repo/backend/confect/operators/schema";

/** Nakafa staff on this deployment. Only internal staff commands write it. */
export default Table.make(() => operatorValidator).index("by_userId", [
  "userId",
]);
