import type { DataPart } from "@repo/ai/schema/data-parts";
import type { Metadata } from "@repo/ai/schema/metadata";
import type { UIMessage, UIMessagePart } from "ai";

export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;
export type MyUITools = Record<string, never>;
export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
export type MyUIMessagePart = UIMessagePart<MyUIDataTypes, MyUITools>;
