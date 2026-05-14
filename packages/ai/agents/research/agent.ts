import { google } from "@ai-sdk/google";
import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { createGroundingWebSearchData } from "@repo/ai/agents/research/grounding";
import { researchPrompt } from "@repo/ai/agents/research/prompt";
import {
  scrapeInputSchema,
  webSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import {
  hasUsableWebSearchEvidence,
  prepareGoogleGroundingStep,
  prepareWebSearchStep,
} from "@repo/ai/agents/research/step";
import { scrapeUrl } from "@repo/ai/agents/research/tools/scrape";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import { getSourceReferences } from "@repo/ai/lib/source";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, type ModelMessage, stepCountIs, tool } from "ai";
import dedent from "dedent";
import { Effect } from "effect";

/**
 * Runs the research agent and returns text with token usage.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({
    task,
    modelId,
    locale,
    context,
    sourceReferences: messageSourceReferences,
    toolCallId,
    writer,
  }: ResearchAgentParams) {
    let needsGoogleGrounding = false;
    let triedGoogleGrounding = false;
    const sourceReferences = getUniqueSourceReferences([
      ...messageSourceReferences,
      ...getSourceReferences(task),
    ]);
    const result = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchPrompt({ locale, context }),
        messages: createResearchMessages(task, sourceReferences),
        tools: {
          google_search: google.tools.googleSearch({
            searchTypes: { webSearch: {} },
          }),
          webSearch: tool({
            description: nakafaWebSearch,
            inputSchema: webSearchInputSchema,
            outputSchema: textOutputSchema,
            execute: ({ query }, { toolCallId }) =>
              Effect.runPromise(
                searchWeb({ query, toolCallId, writer }).pipe(
                  Effect.tap((output) =>
                    Effect.sync(() => {
                      needsGoogleGrounding = !hasUsableWebSearchEvidence(
                        output.result
                      );
                    })
                  ),
                  Effect.map((output) => output.text)
                )
              ),
          }),
          scrape: tool({
            description: nakafaScrape,
            inputSchema: scrapeInputSchema,
            outputSchema: textOutputSchema,
            execute: ({ urlToCrawl }, { toolCallId }) =>
              Effect.runPromise(
                scrapeUrl({ toolCallId, url: urlToCrawl, writer })
              ),
          }),
        },
        /**
         * Reference: AI SDK `prepareStep` supports per-step `toolChoice`,
         * `activeTools`, and message overrides.
         * https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
         */
        prepareStep: ({ messages, steps }) => {
          const hasWebSearchToolCall = steps.some((step) =>
            step.toolCalls.some((toolCall) => toolCall.toolName === "webSearch")
          );
          const webSearchStep = prepareWebSearchStep({
            hasSourceReferences: sourceReferences.length > 0,
            hasWebSearchToolCall,
          });

          if (webSearchStep) {
            return webSearchStep;
          }

          if (!needsGoogleGrounding) {
            return;
          }

          if (triedGoogleGrounding) {
            return;
          }

          triedGoogleGrounding = true;

          return prepareGoogleGroundingStep(messages);
        },
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getModelProviderOptions(modelId),
        },
        stopWhen: stepCountIs(5),
      })
    );

    const groundedSearchData = createGroundingWebSearchData({
      providerMetadata: result.providerMetadata,
      query: task,
      sources: result.sources,
    });

    if (groundedSearchData) {
      writer.write({
        id: `${toolCallId}-grounding`,
        type: "data-web-search",
        data: groundedSearchData,
      });
    }

    return {
      text: result.text,
      usage: result.totalUsage,
    };
  }
);

/**
 * Adds explicit user source references to the research task without hiding the original request.
 */
function createResearchMessages(
  task: string,
  sourceReferences: ResearchAgentParams["sourceReferences"]
) {
  if (sourceReferences.length === 0) {
    return [{ role: "user", content: task }] satisfies ModelMessage[];
  }

  const sourceList = sourceReferences
    .map((source, index) => `${index + 1}. ${source.href}`)
    .join("\n");

  return [
    {
      role: "user",
      content: dedent(`
        ${task}

        Explicit source references from the user's latest message:
        ${sourceList}
      `),
    },
  ] satisfies ModelMessage[];
}

/**
 * Keeps source references unique while preserving the user's order.
 */
function getUniqueSourceReferences(
  sourceReferences: ResearchAgentParams["sourceReferences"]
) {
  const seen = new Set<string>();

  return sourceReferences.flatMap((source) => {
    if (seen.has(source.href)) {
      return [];
    }

    seen.add(source.href);
    return [source];
  });
}
