import { Table } from "@confect/core";
import { insightScoreValidator } from "@repo/backend/confect/insight/schema";

/** What each sitting's results said of the forecast, until the month's test counts them. */
export default Table.make(() => insightScoreValidator)
  .index("by_sittingId", ["sittingId"])
  .index("by_at", ["at"]);
