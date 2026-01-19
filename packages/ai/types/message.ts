import type { DataPart } from "@repo/ai/schema/data-parts";
import type { Metadata } from "@repo/ai/schema/metadata";
import type { tools } from "@repo/ai/tools";
import type { InferUITools, UIMessage, UIMessagePart } from "ai";

export type MyUITools = InferUITools<ReturnType<typeof tools>>;
export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;
export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
export type MyUIMessagePart = UIMessagePart<MyUIDataTypes, MyUITools>;
