import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import chatsTable from "@repo/backend/confect/_generated/tables/chats";
import messagePartsTable from "@repo/backend/confect/_generated/tables/messageParts";
import messagesTable from "@repo/backend/confect/_generated/tables/messages";
import { Schema } from "effect";
/**
 * Paginated chats validator
 */
export const paginatedChatsValidator = PaginationResultSchema(chatsTable.Doc);

/**
 * Message with parts document validator
 * Used for chat transcript query results - returns raw DB documents
 */
export const messageWithPartsDocValidator = Schema.Struct({
  ...messagesTable.Doc.fields,
  ...{
    parts: Schema.Array(messagePartsTable.Doc),
  },
});
export type MessageWithPartsDoc = Schema.Schema.Type<
  typeof messageWithPartsDocValidator
>;

/** Paginated chat transcript validator. */
export const paginatedMessagesValidator = PaginationResultSchema(
  messageWithPartsDocValidator
);
