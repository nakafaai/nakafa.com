import { dedentString } from "../lib/utils";

export function createPrompt(opts: {
  // The context of the task
  taskContext: string;
  // Any advice about output tone
  toneContext?: string;
  // Background data, documents, etc.
  backgroundData?: string;
  // Detailed task instructions & rules
  detailedTaskInstructions?: string;
  // Exemplars of good/bad output
  examples?: string;
  // Conversation history between the user and the assistant
  conversationHistory?: string;
  // The "ask" for the LLM: "Create an annotated version of the transcript..."
  finalRequest: string;
  // "Think about your answer first", if needed
  chainOfThought?: string;
  // "Reply in <response></response> tags"
  outputFormatting?: string;
}): string {
  return dedentString(
    [
      opts.taskContext,
      opts.toneContext,
      opts.backgroundData,
      opts.detailedTaskInstructions,
      opts.examples,
      opts.conversationHistory,
      opts.finalRequest,
      opts.chainOfThought,
      opts.outputFormatting,
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}
