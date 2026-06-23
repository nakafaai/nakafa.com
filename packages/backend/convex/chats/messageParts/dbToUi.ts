import { LearningArtifactManifestSchema } from "@repo/ai/schema/artifact";
import { NakafaDataSchema } from "@repo/ai/schema/data";
import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  requirePartField,
  requireToolState,
} from "@repo/backend/convex/chats/messageParts/shared";
import { ConvexError } from "convex/values";
import { Schema } from "effect";

/**
 * Rebuilds one UI message part from the flattened persisted part row.
 */
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
            input: part.toolNakafaInput,
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
            input: requirePartField({
              value: part.toolNakafaInput,
              fieldName: "toolNakafaInput",
              partType: part.type,
            }),
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
            input: requirePartField({
              value: part.toolNakafaInput,
              fieldName: "toolNakafaInput",
              partType: part.type,
            }),
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
            input: part.toolNakafaInput,
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
            input: part.toolDeepResearchInput,
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
            input: requirePartField({
              value: part.toolDeepResearchInput,
              fieldName: "toolDeepResearchInput",
              partType: part.type,
            }),
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
            input: requirePartField({
              value: part.toolDeepResearchInput,
              fieldName: "toolDeepResearchInput",
              partType: part.type,
            }),
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
            input: part.toolDeepResearchInput,
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
            input: part.toolMathInput,
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
            input: requirePartField({
              value: part.toolMathInput,
              fieldName: "toolMathInput",
              partType: part.type,
            }),
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
            input: requirePartField({
              value: part.toolMathInput,
              fieldName: "toolMathInput",
              partType: part.type,
            }),
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
            input: part.toolMathInput,
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
        data: Schema.decodeUnknownSync(NakafaDataSchema)(
          requirePartField({
            value: part.dataNakafaData,
            fieldName: "dataNakafaData",
            partType: part.type,
          })
        ),
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
    case "data-artifact":
      return {
        type: part.type,
        id: requirePartField({
          value: part.dataArtifactId,
          fieldName: "dataArtifactId",
          partType: part.type,
        }),
        data: Schema.decodeUnknownSync(LearningArtifactManifestSchema)(
          requirePartField({
            value: part.dataArtifactData,
            fieldName: "dataArtifactData",
            partType: part.type,
          })
        ),
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
          title: part.dataScrapeUrlTitle,
          description: part.dataScrapeUrlDescription,
          favicon: part.dataScrapeUrlFavicon,
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
          provider: part.dataWebSearchProvider,
          queries: requirePartField({
            value: part.dataWebSearchQueries,
            fieldName: "dataWebSearchQueries",
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
