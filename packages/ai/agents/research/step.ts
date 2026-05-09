import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import type { ModelMessage } from "ai";
import { Option } from "effect";

const scrapeActiveTools = ["scrape"] satisfies "scrape"[];
const scrapeToolChoice = {
  toolName: "scrape",
  type: "tool",
} satisfies { toolName: "scrape"; type: "tool" };

/**
 * Selects the first ranked source URL returned by web search.
 */
export function selectScrapeUrl(result: WebSearchOutput) {
  for (const source of result.sources) {
    const url = source.url.trim();

    if (url.length > 0) {
      return Option.some(url);
    }
  }

  return Option.none();
}

/**
 * Builds the AI SDK step override that completes webSearch -> scrape.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareScrapeStep(
  url: Option.Option<string>,
  messages: ModelMessage[],
  hasScrapeToolCall: boolean
) {
  if (Option.isNone(url)) {
    return;
  }

  if (hasScrapeToolCall) {
    return;
  }

  const input = JSON.stringify({
    urlToCrawl: url.value,
  });
  const message = {
    role: "user",
    content: `Call the scrape tool now with this exact input and wait for the result before answering.\n\n${input}\n\nDo not call webSearch again for this source.`,
  } satisfies ModelMessage;

  return {
    activeTools: scrapeActiveTools,
    messages: [...messages, message],
    toolChoice: scrapeToolChoice,
  };
}
