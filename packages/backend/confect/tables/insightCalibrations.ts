import { Table } from "@confect/core";
import { insightCalibrationValidator } from "@repo/backend/confect/insight/schema";

/** The forecast's test of each month, read newest first. */
export default Table.make(() => insightCalibrationValidator).index("by_month", [
  "month",
]);
