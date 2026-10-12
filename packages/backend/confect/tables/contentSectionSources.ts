import { Table } from "@confect/core";
import { sourceValidator } from "@repo/backend/confect/contents/sections/schema";

/**
 * One row per document that has sections in `contentSections`: the version its
 * sections were made from. A build reads this row to pass over a document that
 * has not changed, instead of reading its source and its sections, and writes it
 * in the same transaction that stores the sections, so it never names a version
 * that the stored sections lack. Like `contentSections`, it is derived: deleting
 * it makes the next build split every document again.
 */
export default Table.make(() => sourceValidator).index(
  "by_appLocale_and_contentKey",
  ["appLocale", "contentKey"]
);
