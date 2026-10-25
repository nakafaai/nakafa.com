import { Table } from "@confect/core";
import { sourceRecordValidator } from "@repo/backend/confect/contents/sections/schema";

/**
 * One row per document that has sections in `contentSections`: the version its
 * sections were made from, and how many of them the model left out. A build
 * reads this row to pass over a document that has not changed, instead of
 * reading its source and its sections, and writes it in the same transaction
 * that stores the sections. A document with sections left out keeps its row, so
 * that a build reads it again and the clean-up still finds its sections. Like
 * `contentSections`, it is derived: deleting it makes the next build split every
 * document again.
 */
export default Table.make(() => sourceRecordValidator).index(
  "by_appLocale_and_contentKey",
  ["appLocale", "contentKey"]
);
