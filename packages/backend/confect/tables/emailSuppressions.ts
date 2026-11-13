import { Table } from "@confect/core";
import { emailSuppressionValidator } from "@repo/backend/confect/emails/unsubscribe/schema";

export default Table.make(() => emailSuppressionValidator).index("by_address", [
  "address",
]);
