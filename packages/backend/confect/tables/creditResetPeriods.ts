import { Table } from "@confect/core";
import { creditResetPeriodValidator } from "@repo/backend/confect/credits/schema";
export default Table.make(() => creditResetPeriodValidator).index("by_plan", [
  "plan",
]);
