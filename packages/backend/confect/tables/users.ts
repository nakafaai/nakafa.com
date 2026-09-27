import { Table } from "@confect/core";
import { userValidator } from "@repo/backend/confect/users/schema";
export default Table.make(() => userValidator)
  .index("by_email", ["email"])
  .index("by_authId", ["authId"]);
