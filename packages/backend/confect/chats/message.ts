import type { ChatMessageMetadata } from "@repo/backend/confect/chats/schema";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import type { MyUITools } from "@repo/backend/confect/nina/contract/tools";
import type { UIMessage, UIMessagePart } from "ai";

export type MyUIDataTypes = DataPart;
export type MyMetadata = ChatMessageMetadata;

export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
export type MyUIMessagePart = UIMessagePart<MyUIDataTypes, MyUITools>;
