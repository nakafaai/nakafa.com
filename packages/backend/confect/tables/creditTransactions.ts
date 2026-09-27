import { Table } from "@confect/core";
import { creditTransactionValidator } from "@repo/backend/confect/credits/schema";
export default Table.make(() => creditTransactionValidator).index("by_userId", [
  "userId",
]);
