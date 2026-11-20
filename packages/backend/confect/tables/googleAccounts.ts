import { Table } from "@confect/core";
import { googleAccountValidator } from "@repo/backend/confect/identity/schema";

export default Table.make(() => googleAccountValidator)
  .index("by_subject", ["subject"])
  .index("by_userId", ["userId"]);
