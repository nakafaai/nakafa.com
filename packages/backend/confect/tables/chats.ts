import { Table } from "@confect/core";
import { chatValidator } from "@repo/backend/confect/chats/schema";
export default Table.make(() => chatValidator)
  .index("by_userId", ["userId"])
  .index("by_userId_and_visibility", ["userId", "visibility"])
  .index("by_userId_and_type", ["userId", "type"])
  .index("by_userId_and_visibility_and_type", ["userId", "visibility", "type"])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["userId", "visibility", "type"],
  });
