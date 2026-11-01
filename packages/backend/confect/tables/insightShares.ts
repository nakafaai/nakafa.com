import { Table } from "@confect/core";
import { insightShareValidator } from "@repo/backend/confect/insight/schema";

/** The practice topics each student shares with their school. */
export default Table.make(() => insightShareValidator).index(
  "by_personId_and_topic",
  ["personId", "countryKey", "examKey", "trackKey"]
);
