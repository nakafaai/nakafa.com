import type { DataPart } from "@repo/ai/schema/data";
import type { Metadata } from "@repo/ai/schema/metadata";
import type { MyUITools } from "@repo/ai/schema/tools";
import type { UIMessage, UIMessagePart } from "ai";

export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;

export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
export type MyUIMessagePart = UIMessagePart<MyUIDataTypes, MyUITools>;
