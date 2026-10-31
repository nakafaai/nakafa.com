import { Table } from "@confect/core";
import { uploadValidator } from "@repo/backend/confect/classroom/forum/attachment";

/** The files their authors uploaded and have not sent yet, oldest first for the daily sweep. */
export default Table.make(() => uploadValidator).index("by_createdAt", [
  "createdAt",
]);
