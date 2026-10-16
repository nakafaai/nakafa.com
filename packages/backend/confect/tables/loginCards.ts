import { Table } from "@confect/core";
import { loginCardValidator } from "@repo/backend/confect/identity/schema";

export default Table.make(() => loginCardValidator)
  .index("by_codeHash", ["codeHash"])
  .index("by_personId", ["personId"]);
