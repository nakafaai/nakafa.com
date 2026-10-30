import { Table } from "@confect/core";
import { connectorLinkValidator } from "@repo/backend/confect/connectors/schema";

/** The links of Classroom courses to classes, by the connection that reads them and by course. */
export default Table.make(() => connectorLinkValidator).index(
  "by_connectionId_and_courseId",
  ["connectionId", "courseId"]
);
