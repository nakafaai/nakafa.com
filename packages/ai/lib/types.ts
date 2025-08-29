import type { InferUITools, UIMessage } from "ai";
import type { tools } from "../tools";

export type MyUITools = InferUITools<typeof tools>;
export type MyUIDataTypes = {
  suggestions: string[];
};
export type MyUIMessage = UIMessage<never, MyUIDataTypes, MyUITools>;
