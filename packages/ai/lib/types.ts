import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { tools } from "../tools";

export type MyUITools = InferUITools<typeof tools>;
export type MyUIMessage = UIMessage<never, UIDataTypes, MyUITools>;
