import type { InferUITools, UIMessage } from "ai";
import type { tools } from "../tools";
import type { DataPart } from "./data-parts";
import type { Metadata } from "./metadata";

export type MyUITools = InferUITools<ReturnType<typeof tools>>;
export type MyUIDataTypes = DataPart;
export type MyMetadata = Metadata;
export type MyUIMessage = UIMessage<MyMetadata, MyUIDataTypes, MyUITools>;
