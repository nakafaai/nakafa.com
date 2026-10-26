import { Table } from "@confect/core";
import { creditPoolDayValidator } from "@repo/backend/confect/credits/schema";

/** The Nina credits one member drew from their school's pool on one day, which the school's daily cap bounds. */
export default Table.make(() => creditPoolDayValidator).index(
  "by_tenantId_and_userId_and_day",
  ["tenantId", "userId", "day"]
);
