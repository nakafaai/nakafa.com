import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  requirePartField,
  requireToolState,
} from "@repo/backend/convex/chats/messageParts/shared";
import { ConvexError } from "convex/values";

function requireToolInputQuery(
  part: Doc<"parts">,
  fieldName:
    | "toolContentAccessInput"
    | "toolDeepResearchInput"
    | "toolMathCalculationInput"
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
    case "source-document":
      return {
        type: part.type,
        sourceId: requirePartField({
          value: part.sourceDocumentSourceId,
          fieldName: "sourceDocumentSourceId",
          partType: part.type,
        }),
        mediaType: requirePartField({
          value: part.sourceDocumentMediaType,
          fieldName: "sourceDocumentMediaType",
          partType: part.type,
        }),
        title: requirePartField({
          value: part.sourceDocumentTitle,
          fieldName: "sourceDocumentTitle",
          partType: part.type,
        }),
        filename: requirePartField({
          value: part.sourceDocumentFilename,
          fieldName: "sourceDocumentFilename",
          partType: part.type,
        }),
        providerMetadata: part.providerMetadata,
      };
    case "source-url":
      return {
        type: part.type,
        sourceId: requirePartField({
          value: part.sourceUrlSourceId,
          fieldName: "sourceUrlSourceId",
          partType: part.type,
        }),
        url: requirePartField({
          value: part.sourceUrlUrl,
          fieldName: "sourceUrlUrl",
          partType: part.type,
        }),
        title: requirePartField({
          value: part.sourceUrlTitle,
          fieldName: "sourceUrlTitle",
          partType: part.type,
        }),
        providerMetadata: part.providerMetadata,
      };
    case "step-start":
      return {
        type: part.type,
      };
    case "tool-contentAccess": {
      const toolState = requireToolState(part);
      const input = { query: part.toolContentAccessInput ?? "" };

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
            input: requireToolInputQuery(part, "toolContentAccessInput"),
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
            input: requireToolInputQuery(part, "toolContentAccessInput"),
            output: requirePartField({
              value: part.toolContentAccessOutput,
              fieldName: "toolContentAccessOutput",
              partType: part.type,
            }),
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
            input: requireToolInputQuery(part, "toolContentAccessInput"),
            errorText: requirePartField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
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
            input: requireToolInputQuery(part, "toolDeepResearchInput"),
            output: requirePartField({
              value: part.toolDeepResearchOutput,
              fieldName: "toolDeepResearchOutput",
              partType: part.type,
            }),
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
            input: requireToolInputQuery(part, "toolDeepResearchInput"),
            errorText: requirePartField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new ConvexError({
            code: "CHAT_TOOL_STATE_UNSUPPORTED",
            message: `Unsupported persisted tool state: ${toolState}`,
          });
      }
    }
    case "tool-mathCalculation": {
      const toolState = requireToolState(part);
      const input = { query: part.toolMathCalculationInput ?? "" };

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
            input: requireToolInputQuery(part, "toolMathCalculationInput"),
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
            input: requireToolInputQuery(part, "toolMathCalculationInput"),
            output: requirePartField({
              value: part.toolMathCalculationOutput,
              fieldName: "toolMathCalculationOutput",
              partType: part.type,
            }),
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
            input: requireToolInputQuery(part, "toolMathCalculationInput"),
            errorText: requirePartField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
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
    case "data-get-articles":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataGetArticlesId,
          fieldName: "dataGetArticlesId",
          partType: part.type,
        }),
        data: {
          baseUrl: requirePartField({
            value: part.dataGetArticlesBaseUrl,
            fieldName: "dataGetArticlesBaseUrl",
            partType: part.type,
          }),
          input: {
            locale: requirePartField({
              value: part.dataGetArticlesInputLocale,
              fieldName: "dataGetArticlesInputLocale",
              partType: part.type,
            }),
            category: requirePartField({
              value: part.dataGetArticlesInputCategory,
              fieldName: "dataGetArticlesInputCategory",
              partType: part.type,
            }),
          },
          articles: requirePartField({
            value: part.dataGetArticlesArticles,
            fieldName: "dataGetArticlesArticles",
            partType: part.type,
          }),
          status: requirePartField({
            value: part.dataGetArticlesStatus,
            fieldName: "dataGetArticlesStatus",
            partType: part.type,
          }),
          error: part.dataGetArticlesError,
        },
      };
    case "data-get-subjects":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataGetSubjectsId,
          fieldName: "dataGetSubjectsId",
          partType: part.type,
        }),
        data: {
          baseUrl: requirePartField({
            value: part.dataGetSubjectsBaseUrl,
            fieldName: "dataGetSubjectsBaseUrl",
            partType: part.type,
          }),
          input: {
            locale: requirePartField({
              value: part.dataGetSubjectsInputLocale,
              fieldName: "dataGetSubjectsInputLocale",
              partType: part.type,
            }),
            category: requirePartField({
              value: part.dataGetSubjectsInputCategory,
              fieldName: "dataGetSubjectsInputCategory",
              partType: part.type,
            }),
            grade: requirePartField({
              value: part.dataGetSubjectsInputGrade,
              fieldName: "dataGetSubjectsInputGrade",
              partType: part.type,
            }),
            material: requirePartField({
              value: part.dataGetSubjectsInputMaterial,
              fieldName: "dataGetSubjectsInputMaterial",
              partType: part.type,
            }),
          },
          subjects: requirePartField({
            value: part.dataGetSubjectsSubjects,
            fieldName: "dataGetSubjectsSubjects",
            partType: part.type,
          }),
          status: requirePartField({
            value: part.dataGetSubjectsStatus,
            fieldName: "dataGetSubjectsStatus",
            partType: part.type,
          }),
          error: part.dataGetSubjectsError,
        },
      };
    case "data-get-content":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataGetContentId,
          fieldName: "dataGetContentId",
          partType: part.type,
        }),
        data: {
          url: requirePartField({
            value: part.dataGetContentUrl,
            fieldName: "dataGetContentUrl",
            partType: part.type,
          }),
          title: requirePartField({
            value: part.dataGetContentTitle,
            fieldName: "dataGetContentTitle",
            partType: part.type,
          }),
          description: requirePartField({
            value: part.dataGetContentDescription,
            fieldName: "dataGetContentDescription",
            partType: part.type,
          }),
          status: requirePartField({
            value: part.dataGetContentStatus,
            fieldName: "dataGetContentStatus",
            partType: part.type,
          }),
          error: part.dataGetContentError,
        },
      };
    case "data-calculator":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataCalculatorId,
          fieldName: "dataCalculatorId",
          partType: part.type,
        }),
        data: {
          original: requirePartField({
            value: part.dataCalculatorOriginal,
            fieldName: "dataCalculatorOriginal",
            partType: part.type,
          }),
          result: requirePartField({
            value: part.dataCalculatorResult,
            fieldName: "dataCalculatorResult",
            partType: part.type,
          }),
          status: requirePartField({
            value: part.dataCalculatorStatus,
            fieldName: "dataCalculatorStatus",
            partType: part.type,
          }),
          error: part.dataCalculatorError,
        },
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
