import dedent from "dedent";

export function createPrompt(opts: {
  // Identity, role, and the single job for this prompt only.
  taskContext: string;
  // User-facing voice, tone, and language style only.
  toneContext?: string;
  // Runtime facts, retrieved context, documents, or other input data only.
  backgroundData?: string;
  // Tool catalog, tool selection, required tool inputs, and tool ordering only.
  toolUsageGuidelines?: string;
  // Evidence contracts, routing consequences, safety, recovery, and teaching rules.
  detailedTaskInstructions?: string;
  // Exemplars of good/bad output
  examples?: string;
  // Conversation history between the user and the assistant
  conversationHistory?: string;
  // The "ask" for the LLM: "Create an annotated version of the transcript..."
  finalRequest?: string;
  // Private planning guidance only, when a prompt truly needs it.
  chainOfThought?: string;
  // Final response shape and formatting constraints only.
  outputFormatting?: string;
}): string {
  return dedent(
    [
      opts.taskContext,
      opts.toneContext,
      opts.backgroundData,
      opts.toolUsageGuidelines,
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
