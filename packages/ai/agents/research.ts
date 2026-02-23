import type { ModelId } from "@repo/ai/config/vercel";
import { researchAgentPrompt } from "@repo/ai/prompt/agents/research";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getToolsByCategory } from "./registry";
import type { SubAgentResult } from "./schema";

/**
 * Research Agent
 *
 * Evidence of AI SDK best practices:
 * - Uses ToolLoopAgent for tool execution in a loop
 * - Factory pattern with writer injection for streaming
 * - Same model as orchestrator (user's selection)
 * - Streaming via async generators
 * - References: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
 * - References: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress
 */

interface CreateResearchAgentParams {
  selectedModel: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Create a research agent instance
 */
export function createResearchAgent({
  writer,
  selectedModel,
}: CreateResearchAgentParams) {
  const toolsArray = getToolsByCategory({
    category: "research",
    writer,
  });

  // Convert array to ToolSet object
  const tools = Object.fromEntries(
    toolsArray.map((tool, index) => [`research_tool_${index}`, tool])
  );

  return new ToolLoopAgent({
    model: selectedModel,
    instructions: researchAgentPrompt(),
    tools,
    stopWhen: stepCountIs(10),
  });
}

interface RunResearchParams {
  abortSignal?: AbortSignal;
  selectedModel: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Run research agent for a specific task
 *
 * Evidence of AI SDK best practices:
 * - Uses async generator for streaming
 * - Returns summary for parent context control
 * - Tracks token usage
 * - References: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress
 */
export async function* runResearch({
  writer,
  selectedModel,
  task,
  abortSignal,
}: RunResearchParams): AsyncGenerator<MyUIMessage, SubAgentResult, unknown> {
  const agent = createResearchAgent({ writer, selectedModel });

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
    if (message.parts) {
      for (const part of message.parts) {
        if (part.type === "text" && part.text) {
          finalText = part.text;
        }
      }
    }
  }

  // Get usage from the response
  const response = await stream.response;
  const lastMessage = response.messages[response.messages.length - 1];
  if (lastMessage && "usage" in lastMessage) {
    const usage = (
      lastMessage as { usage?: { inputTokens?: number; outputTokens?: number } }
    ).usage;
    inputTokens = usage?.inputTokens ?? 0;
    outputTokens = usage?.outputTokens ?? 0;
  }

  return {
    agentType: "research",
    output: finalText || "Research completed",
    usage: {
      input: inputTokens,
      output: outputTokens,
    },
  };
}

/**
 * Check if URL is external (not nakafa.com)
 */
export function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const blockedDomains = ["nakafa.com", "localhost", "127.0.0.1"];
    return !blockedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

interface ValidateUrlResult {
  external: boolean;
  reason?: string;
  valid: boolean;
}

/**
 * Validate URL for scraping
 */
export function validateUrl(url: string): ValidateUrlResult {
  try {
    new URL(url);

    if (!isExternalUrl(url)) {
      return {
        valid: false,
        external: false,
        reason: "Cannot scrape Nakafa URLs or localhost",
      };
    }

    return { valid: true, external: true };
  } catch {
    return { valid: false, external: false, reason: "Invalid URL format" };
  }
}

// URL regex pattern at top level for performance
const URL_REGEX = /https?:\/\/[^\s]+/i;

/**
 * Extract URL from query text
 */
export function extractUrlFromQuery(query: string): string | null {
  const match = query.match(URL_REGEX);
  return match?.[0] ?? null;
}
