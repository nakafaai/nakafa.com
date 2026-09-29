import { Table } from "@confect/core";
import { NinaSummary } from "@repo/backend/confect/nina/summaries.spec";

export default Table.make(() => NinaSummary).index("by_chatId", ["chatId"]);
