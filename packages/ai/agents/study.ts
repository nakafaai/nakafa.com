import type { ModelId } from "@repo/ai/config/vercel";
import { studyAgentPrompt } from "@repo/ai/prompt/agents/study";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getToolsByCategory } from "./registry";
import type { SubAgentResult } from "./schema";

/**
 * Study Agent
 *
 * Evidence of AI SDK best practices:
 * - Uses ToolLoopAgent for tool execution in a loop
 * - Factory pattern with writer injection for streaming
 * - Same model as orchestrator (user's selection)
 * - Streaming via async generators
 * - References: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
 */

interface CreateStudyAgentParams {
  selectedModel: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Create a study agent instance
 */
export function createStudyAgent({
  writer,
  selectedModel,
}: CreateStudyAgentParams) {
  const toolsArray = getToolsByCategory({
    category: "study",
    writer,
  });

  // Convert array to ToolSet object
  const tools = Object.fromEntries(
    toolsArray.map((tool, index) => [`study_tool_${index}`, tool])
  );

  return new ToolLoopAgent({
    model: selectedModel,
    instructions: studyAgentPrompt(),
    tools,
    stopWhen: stepCountIs(10),
  });
}

interface RetrieveContentParams {
  abortSignal?: AbortSignal;
  selectedModel: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Run study agent for content retrieval
 */
export async function* retrieveContent({
  writer,
  selectedModel,
  task,
  abortSignal,
}: RetrieveContentParams): AsyncGenerator<
  MyUIMessage,
  SubAgentResult,
  unknown
> {
  const agent = createStudyAgent({ writer, selectedModel });

  const stream = await agent.stream({
    messages: [{ role: "user", content: task }],
    abortSignal,
  });

  let finalText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  // Use the response stream from StreamTextResult
  for await (const message of stream.toUIMessageStream()) {
    yield message as MyUIMessage;
    // Accumulate text from parts if available
    if ("parts" in message && message.parts) {
      for (const part of message.parts) {
        if (part.type === "text" && part.text) {
          finalText = part.text;
        }
      }
    }
  }

  // Get usage from the response
  const response = await stream.response;
  const lastMessage = response.messages.at(-1);
  if (lastMessage && "usage" in lastMessage) {
    const usage = (
      lastMessage as { usage?: { inputTokens?: number; outputTokens?: number } }
    ).usage;
    inputTokens = usage?.inputTokens ?? 0;
    outputTokens = usage?.outputTokens ?? 0;
  }

  return {
    agentType: "study",
    output: finalText || "Content retrieval completed",
    usage: {
      input: inputTokens,
      output: outputTokens,
    },
  };
}

// Content-related keywords for query detection
const CONTENT_KEYWORDS = [
  "subject",
  "article",
  "content",
  "lesson",
  "topic",
  "find",
  "get",
  "retrieve",
  "nakafa",
];

/**
 * Check if query is about Nakafa content
 */
export function isContentQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return CONTENT_KEYWORDS.some((keyword) => lowerQuery.includes(keyword));
}
