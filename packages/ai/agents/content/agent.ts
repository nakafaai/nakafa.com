import {
  nakafaArticles,
  nakafaContent,
  nakafaSubjects,
} from "@repo/ai/agents/content/descriptions";
import { contentPrompt } from "@repo/ai/agents/content/prompt";
import {
  getArticlesInputSchema,
  getContentInputSchema,
  getSubjectsInputSchema,
} from "@repo/ai/agents/content/schema";
import { preparePageFetchStep } from "@repo/ai/agents/content/step";
import { getArticles } from "@repo/ai/agents/content/tools/articles";
import { fetchMaterial } from "@repo/ai/agents/content/tools/material/fetch";
import { getSubjects } from "@repo/ai/agents/content/tools/subjects";
import { model } from "@repo/ai/config/vercel";
import type { ContentAgentParams } from "@repo/ai/types/agents";
import {
  generateText,
  InvalidToolInputError,
  stepCountIs,
  type ToolCallRepairFunction,
  type ToolSet,
  tool,
} from "ai";
import { Effect } from "effect";
import * as z from "zod";

type RepairOptions = Parameters<ToolCallRepairFunction<ToolSet>>[0];

/**
 * Runs the content agent and returns text with token usage.
 */
export const runContentAgent = Effect.fn("content.runContentAgent")(function* ({
  task,
  writer,
  modelId,
  locale,
  context,
}: ContentAgentParams) {
  let pageFetchPending = context.needsPageFetch;

  const result = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel(modelId),
      system: contentPrompt({ locale, context }),
      messages: [{ role: "user", content: task }],
      tools: {
        getContent: tool({
          description: nakafaContent,
          inputSchema: getContentInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) => {
            const usePageInput = pageFetchPending;
            pageFetchPending = false;

            return Effect.runPromise(
              fetchMaterial({
                context,
                input,
                locale,
                toolCallId,
                usePageInput,
                writer,
              })
            );
          },
        }),
        getArticles: tool({
          description: nakafaArticles,
          inputSchema: getArticlesInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(getArticles({ input, toolCallId, writer })),
        }),
        getSubjects: tool({
          description: nakafaSubjects,
          inputSchema: getSubjectsInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(getSubjects({ input, toolCallId, writer })),
        }),
      },
      stopWhen: stepCountIs(10),
      experimental_repairToolCall: ({ toolCall, error }) =>
        Effect.runPromise(
          repairPageFetchToolCall({
            error,
            locale,
            needsPageFetch: pageFetchPending,
            slug: context.slug,
            toolCall,
          })
        ),
      prepareStep: ({ stepNumber }) =>
        Effect.runSync(
          preparePageFetchStep({
            needsPageFetch: context.needsPageFetch,
            stepNumber,
          })
        ),
    })
  );

  return {
    text: result.text,
    usage: result.totalUsage,
  };
});

/**
 * Repairs only the forced getContent call with server-derived page input.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-call-repair
 */
const repairPageFetchToolCall = Effect.fn("content.repairPageFetchToolCall")(
  ({
    error,
    locale,
    needsPageFetch,
    slug,
    toolCall,
  }: Pick<RepairOptions, "error" | "toolCall"> &
    Pick<ContentAgentParams, "locale"> & {
      needsPageFetch: boolean;
      slug: string;
    }) => {
    if (!needsPageFetch) {
      return Effect.succeed(null);
    }

    if (toolCall.toolName !== "getContent") {
      return Effect.succeed(null);
    }

    if (!InvalidToolInputError.isInstance(error)) {
      return Effect.succeed(null);
    }

    return Effect.succeed({
      ...toolCall,
      input: JSON.stringify({ locale, slug }, null, 2),
    });
  }
);
