import { Table } from "@confect/core";
import { creditPoolValidator } from "@repo/backend/confect/credits/schema";

/** The Nina credits a school's members drew in one month. `by_tenantId_and_month` finds the row a reservation counts against. */
export default Table.make(() => creditPoolValidator).index(
  "by_tenantId_and_month",
  ["tenantId", "month"]
);
