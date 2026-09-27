import { Table } from "@confect/core";
import { welcomeEmailIntentValidator } from "@repo/backend/confect/emails/welcome/schema";
export default Table.make(() => welcomeEmailIntentValidator)
  .index("by_userId", ["userId"])
  .index("by_phase", ["phase"]);
