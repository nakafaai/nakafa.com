import type { orchestratorTools } from "@repo/ai/agents/orchestrator";
import type { DataPart } from "@repo/ai/schema/data-parts";
import type { Metadata } from "@repo/ai/schema/metadata";
import type { InferUITools, UIMessage, UIMessagePart } from "ai";

export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;

// Infer tool types directly from orchestratorTools - clean and type-safe
export type MyUITools = InferUITools<ReturnType<typeof orchestratorTools>>;

export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
export type MyUIMessagePart = UIMessagePart<MyUIDataTypes, MyUITools>;
