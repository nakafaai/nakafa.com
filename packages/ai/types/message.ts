import type { tools } from "@repo/ai/tools";
import type { DataPart } from "@repo/ai/types/data-parts";
import type { Metadata } from "@repo/ai/types/metadata";
import type { InferUITools, UIMessage } from "ai";

export type MyUITools = InferUITools<ReturnType<typeof tools>>;
export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;
export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
