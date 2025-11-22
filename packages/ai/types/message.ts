import type { financeTools, tools } from "@repo/ai/tools";
import type { DataPart } from "@repo/ai/types/data-parts";
import type { Metadata } from "@repo/ai/types/metadata";
import type { InferUITools, UIMessage, UIMessagePart } from "ai";

export type MyUITools = InferUITools<
  ReturnType<typeof tools> & ReturnType<typeof financeTools>
>;
export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;
export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
export type MyUIMessagePart = UIMessagePart<MyUIDataTypes, MyUITools>;
