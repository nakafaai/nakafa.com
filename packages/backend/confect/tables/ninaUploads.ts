import { Table } from "@confect/core";
import { NinaUpload } from "@repo/backend/confect/nina/uploads.spec";

export default Table.make(() => NinaUpload).index("by_userId_and_expiresAt", [
  "userId",
  "expiresAt",
]);
