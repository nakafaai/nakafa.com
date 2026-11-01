import { Table } from "@confect/core";
import { noticeMailBudgetValidator } from "@repo/backend/confect/notifications/mail";

/** How many notice mails left today: one row, which a new day takes over. */
export default Table.make(() => noticeMailBudgetValidator);
