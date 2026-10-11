import chatsTable from "@repo/backend/confect/_generated/tables/chats";
import { Schema, Struct } from "effect";

/**
 * A chat as readers receive it. The stored title is sealed, so every reader
 * opens it first and the title is plain text here, on the wire and in the app.
 */
export const chatViewValidator = chatsTable.Doc.mapFields(
  Struct.assign({ title: Schema.optionalKey(Schema.String) })
);
export type ChatView = typeof chatViewValidator.Type;
