import { Table } from "@confect/core";
import { sectionRowValidator } from "@repo/backend/confect/contents/sections/schema";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";

/**
 * One row per heading section of a lesson or article and per passage of the
 * Quran, in each language. It is a read model derived from the active release:
 * it can be deleted and rebuilt at any time.
 */
export default Table.make(() => sectionRowValidator)
  .index("by_appLocale_and_contentKey_and_ordinal", [
    "appLocale",
    "contentKey",
    "ordinal",
  ])
  .searchIndex("search_text", {
    searchField: "text",
    filterFields: ["section"],
  })
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: embeddingDimensions,
    filterFields: ["scope"],
  });
