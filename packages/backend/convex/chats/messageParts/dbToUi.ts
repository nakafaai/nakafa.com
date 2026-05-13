import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  requirePartField,
  requireToolState,
} from "@repo/backend/convex/chats/messageParts/shared";
import { ConvexError } from "convex/values";

function requireToolInputQuery(
  part: Doc<"parts">,
  fieldName: "toolNakafaInput" | "toolDeepResearchInput" | "toolMathInput"
) {
  return {
    query: requirePartField({
      value: part[fieldName],
      fieldName,
      partType: part.type,
    }),
  };
}

/** Rebuild one UI message part from the flattened persisted part row. */
export function mapDBPartToUIMessagePart({
  part,
}: {
  part: Doc<"parts">;
}): MyUIMessagePart {
  switch (part.type) {
    case "text":
      return {
        type: part.type,
        text: requirePartField({
          value: part.textText,
          fieldName: "textText",
          partType: part.type,
        }),
        state: part.textState,
      };
    case "reasoning":
      return {
        type: part.type,
        text: requirePartField({
          value: part.reasoningText,
          fieldName: "reasoningText",
          partType: part.type,
        }),
        state: part.reasoningState,
        providerMetadata: part.providerMetadata,
      };
    case "file":
      return {
        type: part.type,
        mediaType: requirePartField({
          value: part.fileMediaType,
          fieldName: "fileMediaType",
          partType: part.type,
        }),
        filename: requirePartField({
          value: part.fileFilename,
          fieldName: "fileFilename",
          partType: part.type,
        }),
        url: requirePartField({
          value: part.fileUrl,
          fieldName: "fileUrl",
          partType: part.type,
        }),
      };
    case "step-start":
      return {
        type: part.type,
      };
    case "tool-nakafa": {
      const toolState = requireToolState(part);
      const input = { query: part.toolNakafaInput ?? "" };

      switch (toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input,
          };
        case "input-available":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolNakafaInput"),
          };
        case "output-available":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolNakafaInput"),
            output: requirePartField({
              value: part.toolNakafaOutput,
              fieldName: "toolNakafaOutput",
              partType: part.type,
            }),
            resultProviderMetadata: part.toolResultProviderMetadata,
          };
        case "output-error":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolNakafaInput"),
            errorText: requirePartField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
            resultProviderMetadata: part.toolResultProviderMetadata,
          };
        default:
          throw new ConvexError({
            code: "CHAT_TOOL_STATE_UNSUPPORTED",
            message: `Unsupported persisted tool state: ${toolState}`,
          });
      }
    }
    case "tool-deepResearch": {
      const toolState = requireToolState(part);
      const input = { query: part.toolDeepResearchInput ?? "" };

      switch (toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input,
          };
        case "input-available":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolDeepResearchInput"),
          };
        case "output-available":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolDeepResearchInput"),
            output: requirePartField({
              value: part.toolDeepResearchOutput,
              fieldName: "toolDeepResearchOutput",
              partType: part.type,
            }),
            resultProviderMetadata: part.toolResultProviderMetadata,
          };
        case "output-error":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolDeepResearchInput"),
            errorText: requirePartField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
            resultProviderMetadata: part.toolResultProviderMetadata,
          };
        default:
          throw new ConvexError({
            code: "CHAT_TOOL_STATE_UNSUPPORTED",
            message: `Unsupported persisted tool state: ${toolState}`,
          });
      }
    }
    case "tool-math": {
      const toolState = requireToolState(part);
      const input = { query: part.toolMathInput ?? "" };

      switch (toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input,
          };
        case "input-available":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolMathInput"),
          };
        case "output-available":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolMathInput"),
            output: requirePartField({
              value: part.toolMathOutput,
              fieldName: "toolMathOutput",
              partType: part.type,
            }),
            resultProviderMetadata: part.toolResultProviderMetadata,
          };
        case "output-error":
          return {
            type: part.type,
            state: toolState,
            toolCallId: requirePartField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            callProviderMetadata: part.toolCallProviderMetadata,
            input: requireToolInputQuery(part, "toolMathInput"),
            errorText: requirePartField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
            resultProviderMetadata: part.toolResultProviderMetadata,
          };
        default:
          throw new ConvexError({
            code: "CHAT_TOOL_STATE_UNSUPPORTED",
            message: `Unsupported persisted tool state: ${toolState}`,
          });
      }
    }
    case "data-suggestions":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataSuggestionsId,
          fieldName: "dataSuggestionsId",
          partType: part.type,
        }),
        data: {
          data: requirePartField({
            value: part.dataSuggestionsData,
            fieldName: "dataSuggestionsData",
            partType: part.type,
          }),
        },
      };
    case "data-nakafa":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataNakafaId,
          fieldName: "dataNakafaId",
          partType: part.type,
        }),
        data: requirePartField({
          value: part.dataNakafaData,
          fieldName: "dataNakafaData",
          partType: part.type,
        }),
      };
    case "data-math":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataMathId,
          fieldName: "dataMathId",
          partType: part.type,
        }),
        data: requirePartField({
          value: part.dataMathData,
          fieldName: "dataMathData",
          partType: part.type,
        }),
      };
    case "data-scrape-url":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataScrapeUrlId,
          fieldName: "dataScrapeUrlId",
          partType: part.type,
        }),
        data: {
          url: requirePartField({
            value: part.dataScrapeUrlUrl,
            fieldName: "dataScrapeUrlUrl",
            partType: part.type,
          }),
          content: requirePartField({
            value: part.dataScrapeUrlContent,
            fieldName: "dataScrapeUrlContent",
            partType: part.type,
          }),
          status: requirePartField({
            value: part.dataScrapeUrlStatus,
            fieldName: "dataScrapeUrlStatus",
            partType: part.type,
          }),
          error: part.dataScrapeUrlError,
        },
      };
    case "data-web-search":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataWebSearchId,
          fieldName: "dataWebSearchId",
          partType: part.type,
        }),
        data: {
          query: requirePartField({
            value: part.dataWebSearchQuery,
            fieldName: "dataWebSearchQuery",
            partType: part.type,
          }),
          sources: requirePartField({
            value: part.dataWebSearchSources,
            fieldName: "dataWebSearchSources",
            partType: part.type,
          }),
          status: requirePartField({
            value: part.dataWebSearchStatus,
            fieldName: "dataWebSearchStatus",
            partType: part.type,
          }),
          error: part.dataWebSearchError,
        },
      };
    default:
      throw new ConvexError({
        code: "CHAT_PART_TYPE_UNSUPPORTED",
        message: `Unsupported persisted part type: ${part.type}`,
      });
  }
}
