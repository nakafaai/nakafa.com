import { Table } from "@confect/core";
import { NinaMemoryPortrait } from "@repo/backend/confect/nina/portrait/schema";

export default Table.make(() => NinaMemoryPortrait).index("by_userId", [
  "userId",
]);
