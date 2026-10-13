import { Id } from "@repo/backend/confect/_generated/id";
import chatsTable from "@repo/backend/confect/_generated/tables/chats";
import { Schema, Struct } from "effect";

/**
 * A chat as a viewer receives it. The stored title is sealed, so every viewer
 * opens it first and the title is plain text here, on the wire and in the app.
 * Only the owner is told which account owns the chat and which turn runs in
 * it, so a viewer's chat may name neither (`readerChat`).
 */
export const chatViewValidator = chatsTable.Doc.mapFields(
  Struct.assign({
    title: Schema.optionalKey(Schema.String),
    userId: Schema.optionalKey(Id("users")),
  })
);
export type ChatView = typeof chatViewValidator.Type;

/**
 * The chat as a viewer who does not own it is told of it: what it takes to
 * show the chat and to read its messages, and nothing of the owner's account.
 * The page takes a chat that names no owner as not its own.
 */
export function readerChat(chat: ChatView): ChatView {
  return Struct.omit(chat, ["activeTurnId", "userId"]);
}
