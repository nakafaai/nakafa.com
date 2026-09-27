import { Table } from "@confect/core";
import { accountConsentValidator } from "@repo/backend/confect/consents/schema";
export default Table.make(() => accountConsentValidator).index(
  "by_userId_and_category",
  ["userId", "category"]
);
