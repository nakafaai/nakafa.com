import type { MyUIMessage, MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "../_generated/dataModel";
import { buildRequiredObject, isNotUndefined } from "../utils/type";

type DBPart = Omit<Doc<"parts">, "_id" | "_creationTime" | "messageId">;

/**
 * Maps UI message parts to database parts with full type safety
 */
export function mapUIMessagePartsToDBParts({
  messageParts,
}: {
  messageParts: MyUIMessage["parts"];
}): DBPart[] {
  return messageParts.map((part, index): DBPart => {
    const baseFields = {
      order: index,
    };

    switch (part.type) {
      case "text":
        return {
          ...baseFields,
          type: part.type,
          textText: part.text,
          textState: part.state,
        };
      case "reasoning":
        return {
          ...baseFields,
          type: part.type,
          reasoningText: part.text,
          reasoningState: part.state,
          providerMetadata: part.providerMetadata,
        };
      case "file":
        return {
          ...baseFields,
          type: part.type,
          fileMediaType: part.mediaType,
          fileFilename: part.filename,
          fileUrl: part.url,
        };
      case "source-document":
        return {
          ...baseFields,
          type: part.type,
          sourceDocumentSourceId: part.sourceId,
          sourceDocumentMediaType: part.mediaType,
          sourceDocumentTitle: part.title,
          sourceDocumentFilename: part.filename,
          providerMetadata: part.providerMetadata,
        };
      case "source-url":
        return {
          ...baseFields,
          type: part.type,
          sourceUrlSourceId: part.sourceId,
          sourceUrlUrl: part.url,
          sourceUrlTitle: part.title,
          providerMetadata: part.providerMetadata,
        };
      case "step-start":
        return {
          ...baseFields,
          type: part.type,
        };

      // Tool parts - these are specific tool names from our tools
      // Note: Tool parts are transient and not rendered in UI, but we store minimal info
      case "tool-getArticles":
        return {
          ...baseFields,
          type: part.type,
          toolToolCallId: part.toolCallId,
          toolState: part.state,
          toolGetArticlesInputLocale: part.input?.locale,
          toolGetArticlesInputCategory: part.input?.category,
          toolGetArticlesOutput: part.output,
          toolErrorText: part.errorText,
        };
      case "tool-getSubjects":
        return {
          ...baseFields,
          type: part.type,
          toolToolCallId: part.toolCallId,
          toolState: part.state,
          toolGetSubjectsInputLocale: part.input?.locale,
          toolGetSubjectsInputCategory: part.input?.category,
          toolGetSubjectsInputGrade: part.input?.grade,
          toolGetSubjectsInputMaterial: part.input?.material,
          toolGetSubjectsOutput: part.output,
          toolErrorText: part.errorText,
        };
      case "tool-getContent":
        return {
          ...baseFields,
          type: part.type,
          toolToolCallId: part.toolCallId,
          toolState: part.state,
          toolGetContentInputLocale: part.input?.locale,
          toolGetContentInputSlug: part.input?.slug,
          toolGetContentOutput: part.output,
          toolErrorText: part.errorText,
        };
      case "tool-calculator":
        return {
          ...baseFields,
          type: part.type,
          toolToolCallId: part.toolCallId,
          toolState: part.state,
          toolCalculatorInputExpression: part.input?.expression,
          toolCalculatorOutput: part.output,
          toolErrorText: part.errorText,
        };
      case "tool-scrape":
        return {
          ...baseFields,
          type: part.type,
          toolToolCallId: part.toolCallId,
          toolState: part.state,
          toolScrapeUrlInputUrlToCrawl: part.input?.urlToCrawl,
          toolScrapeUrlOutput: part.output,
          toolErrorText: part.errorText,
        };
      case "tool-webSearch":
        return {
          ...baseFields,
          type: part.type,
          toolToolCallId: part.toolCallId,
          toolState: part.state,
          toolWebSearchInputQuery: part.input?.query,
          toolWebSearchOutput: part.output,
          toolErrorText: part.errorText,
        };

      // Data parts - these contain the actual data
      case "data-suggestions":
        return {
          ...baseFields,
          type: part.type,
          dataSuggestionsId: part.id,
          dataSuggestionsData: part.data.data,
        };
      case "data-get-articles":
        return {
          ...baseFields,
          type: part.type,
          dataGetArticlesId: part.id,
          dataGetArticlesBaseUrl: part.data.baseUrl,
          dataGetArticlesInputLocale: part.data.input.locale,
          dataGetArticlesInputCategory: part.data.input.category,
          dataGetArticlesArticles: part.data.articles,
          dataGetArticlesStatus: part.data.status,
          dataGetArticlesError: part.data.error,
        };
      case "data-get-subjects":
        return {
          ...baseFields,
          type: part.type,
          dataGetSubjectsId: part.id,
          dataGetSubjectsBaseUrl: part.data.baseUrl,
          dataGetSubjectsInputLocale: part.data.input.locale,
          dataGetSubjectsInputCategory: part.data.input.category,
          dataGetSubjectsInputGrade: part.data.input.grade,
          dataGetSubjectsInputMaterial: part.data.input.material,
          dataGetSubjectsSubjects: part.data.subjects,
          dataGetSubjectsStatus: part.data.status,
          dataGetSubjectsError: part.data.error,
        };
      case "data-get-content":
        return {
          ...baseFields,
          type: part.type,
          dataGetContentId: part.id,
          dataGetContentUrl: part.data.url,
          dataGetContentTitle: part.data.title,
          dataGetContentDescription: part.data.description,
          dataGetContentStatus: part.data.status,
          dataGetContentError: part.data.error,
        };
      case "data-calculator":
        return {
          ...baseFields,
          type: part.type,
          dataCalculatorId: part.id,
          dataCalculatorOriginal: part.data.original,
          dataCalculatorResult: part.data.result,
          dataCalculatorStatus: part.data.status,
          dataCalculatorError: part.data.error,
        };
      case "data-scrape-url":
        return {
          ...baseFields,
          type: part.type,
          dataScrapeUrlId: part.id,
          dataScrapeUrlUrl: part.data.url,
          dataScrapeUrlContent: part.data.content,
          dataScrapeUrlStatus: part.data.status,
          dataScrapeUrlError: part.data.error,
        };
      case "data-web-search":
        return {
          ...baseFields,
          type: part.type,
          dataWebSearchId: part.id,
          dataWebSearchQuery: part.data.query,
          dataWebSearchSources: part.data.sources,
          dataWebSearchStatus: part.data.status,
          dataWebSearchError: part.data.error,
        };
      default: {
        throw new Error(`Unsupported part type: ${JSON.stringify(part)}`);
      }
    }
  });
}

/**
 * Validates and throws error if required field is missing
 */
function requireField<T>({
  value,
  fieldName,
  partType,
}: {
  value: T;
  fieldName: keyof Doc<"parts">;
  partType: Doc<"parts">["type"];
}): Exclude<T, undefined> {
  if (!isNotUndefined(value)) {
    throw new Error(
      `Data integrity error: Required field '${fieldName}' is missing for part type '${partType}'`
    );
  }
  return value;
}

/**
 * Maps database parts to UI message parts with full type safety and validation
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
        text: requireField({
          value: part.textText,
          fieldName: "textText",
          partType: part.type,
        }),
        state: part.textState,
      };
    case "reasoning":
      return {
        type: part.type,
        text: requireField({
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
        mediaType: requireField({
          value: part.fileMediaType,
          fieldName: "fileMediaType",
          partType: part.type,
        }),
        filename: requireField({
          value: part.fileFilename,
          fieldName: "fileFilename",
          partType: part.type,
        }),
        url: requireField({
          value: part.fileUrl,
          fieldName: "fileUrl",
          partType: part.type,
        }),
      };
    case "source-document":
      return {
        type: part.type,
        sourceId: requireField({
          value: part.sourceDocumentSourceId,
          fieldName: "sourceDocumentSourceId",
          partType: part.type,
        }),
        mediaType: requireField({
          value: part.sourceDocumentMediaType,
          fieldName: "sourceDocumentMediaType",
          partType: part.type,
        }),
        title: requireField({
          value: part.sourceDocumentTitle,
          fieldName: "sourceDocumentTitle",
          partType: part.type,
        }),
        filename: requireField({
          value: part.sourceDocumentFilename,
          fieldName: "sourceDocumentFilename",
          partType: part.type,
        }),
        providerMetadata: part.providerMetadata,
      };
    case "source-url":
      return {
        type: part.type,
        sourceId: requireField({
          value: part.sourceUrlSourceId,
          fieldName: "sourceUrlSourceId",
          partType: part.type,
        }),
        url: requireField({
          value: part.sourceUrlUrl,
          fieldName: "sourceUrlUrl",
          partType: part.type,
        }),
        title: requireField({
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

    // Tool parts - handle each separately for proper type narrowing
    case "tool-getArticles": {
      if (!part.toolState) {
        throw new Error("tool_state is undefined");
      }
      const reconstructedInput = {
        locale: part.toolGetArticlesInputLocale,
        category: part.toolGetArticlesInputCategory,
      };
      switch (part.toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: reconstructedInput,
          };
        case "input-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
          };
        case "output-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            output: requireField({
              value: part.toolGetArticlesOutput,
              fieldName: "toolGetArticlesOutput",
              partType: part.type,
            }),
          };
        case "output-error":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            errorText: requireField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new Error(`Unsupported tool state: ${part.toolState}`);
      }
    }
    case "tool-getSubjects": {
      if (!part.toolState) {
        throw new Error("tool_state is undefined");
      }
      const reconstructedInput = {
        locale: part.toolGetSubjectsInputLocale,
        category: part.toolGetSubjectsInputCategory,
        grade: part.toolGetSubjectsInputGrade,
        material: part.toolGetSubjectsInputMaterial,
      };
      switch (part.toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: reconstructedInput,
          };
        case "input-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
          };
        case "output-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            output: requireField({
              value: part.toolGetSubjectsOutput,
              fieldName: "toolGetSubjectsOutput",
              partType: part.type,
            }),
          };
        case "output-error":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            errorText: requireField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new Error(`Unsupported tool state: ${part.toolState}`);
      }
    }
    case "tool-getContent": {
      if (!part.toolState) {
        throw new Error("tool_state is undefined");
      }
      const reconstructedInput = {
        locale: part.toolGetContentInputLocale,
        slug: part.toolGetContentInputSlug,
      };
      switch (part.toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: reconstructedInput,
          };
        case "input-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
          };
        case "output-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            output: requireField({
              value: part.toolGetContentOutput,
              fieldName: "toolGetContentOutput",
              partType: part.type,
            }),
          };
        case "output-error":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            errorText: requireField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new Error(`Unsupported tool state: ${part.toolState}`);
      }
    }
    case "tool-calculator": {
      if (!part.toolState) {
        throw new Error("tool_state is undefined");
      }
      const reconstructedInput = {
        expression: part.toolCalculatorInputExpression,
      };
      switch (part.toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: reconstructedInput,
          };
        case "input-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
          };
        case "output-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            output: requireField({
              value: part.toolCalculatorOutput,
              fieldName: "toolCalculatorOutput",
              partType: part.type,
            }),
          };
        case "output-error":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            errorText: requireField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new Error(`Unsupported tool state: ${part.toolState}`);
      }
    }
    case "tool-scrape": {
      if (!part.toolState) {
        throw new Error("tool_state is undefined");
      }
      const reconstructedInput = {
        urlToCrawl: part.toolScrapeUrlInputUrlToCrawl,
      };
      switch (part.toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: reconstructedInput,
          };
        case "input-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
          };
        case "output-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            output: requireField({
              value: part.toolScrapeUrlOutput,
              fieldName: "toolScrapeUrlOutput",
              partType: part.type,
            }),
          };
        case "output-error":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            errorText: requireField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new Error(`Unsupported tool state: ${part.toolState}`);
      }
    }
    case "tool-webSearch": {
      if (!part.toolState) {
        throw new Error("tool_state is undefined");
      }
      const reconstructedInput = {
        query: part.toolWebSearchInputQuery,
      };
      switch (part.toolState) {
        case "input-streaming":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: reconstructedInput,
          };
        case "input-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
          };
        case "output-available":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            output: requireField({
              value: part.toolWebSearchOutput,
              fieldName: "toolWebSearchOutput",
              partType: part.type,
            }),
          };
        case "output-error":
          return {
            type: part.type,
            state: part.toolState,
            toolCallId: requireField({
              value: part.toolToolCallId,
              fieldName: "toolToolCallId",
              partType: part.type,
            }),
            input: buildRequiredObject(reconstructedInput),
            errorText: requireField({
              value: part.toolErrorText,
              fieldName: "toolErrorText",
              partType: part.type,
            }),
          };
        default:
          throw new Error(`Unsupported tool state: ${part.toolState}`);
      }
    }

    // Data parts
    case "data-suggestions":
      return {
        type: part.type,
        id: requireField({
          value: part.dataSuggestionsId,
          fieldName: "dataSuggestionsId",
          partType: part.type,
        }),
        data: {
          data: requireField({
            value: part.dataSuggestionsData,
            fieldName: "dataSuggestionsData",
            partType: part.type,
          }),
        },
      };
    case "data-get-articles":
      return {
        type: part.type,
        id: requireField({
          value: part.dataGetArticlesId,
          fieldName: "dataGetArticlesId",
          partType: part.type,
        }),
        data: {
          baseUrl: requireField({
            value: part.dataGetArticlesBaseUrl,
            fieldName: "dataGetArticlesBaseUrl",
            partType: part.type,
          }),
          input: {
            locale: requireField({
              value: part.dataGetArticlesInputLocale,
              fieldName: "dataGetArticlesInputLocale",
              partType: part.type,
            }),
            category: requireField({
              value: part.dataGetArticlesInputCategory,
              fieldName: "dataGetArticlesInputCategory",
              partType: part.type,
            }),
          },
          articles: requireField({
            value: part.dataGetArticlesArticles,
            fieldName: "dataGetArticlesArticles",
            partType: part.type,
          }),
          status: requireField({
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
        id: requireField({
          value: part.dataGetSubjectsId,
          fieldName: "dataGetSubjectsId",
          partType: part.type,
        }),
        data: {
          baseUrl: requireField({
            value: part.dataGetSubjectsBaseUrl,
            fieldName: "dataGetSubjectsBaseUrl",
            partType: part.type,
          }),
          input: {
            locale: requireField({
              value: part.dataGetSubjectsInputLocale,
              fieldName: "dataGetSubjectsInputLocale",
              partType: part.type,
            }),
            category: requireField({
              value: part.dataGetSubjectsInputCategory,
              fieldName: "dataGetSubjectsInputCategory",
              partType: part.type,
            }),
            grade: requireField({
              value: part.dataGetSubjectsInputGrade,
              fieldName: "dataGetSubjectsInputGrade",
              partType: part.type,
            }),
            material: requireField({
              value: part.dataGetSubjectsInputMaterial,
              fieldName: "dataGetSubjectsInputMaterial",
              partType: part.type,
            }),
          },
          subjects: requireField({
            value: part.dataGetSubjectsSubjects,
            fieldName: "dataGetSubjectsSubjects",
            partType: part.type,
          }),
          status: requireField({
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
        id: requireField({
          value: part.dataGetContentId,
          fieldName: "dataGetContentId",
          partType: part.type,
        }),
        data: {
          url: requireField({
            value: part.dataGetContentUrl,
            fieldName: "dataGetContentUrl",
            partType: part.type,
          }),
          title: requireField({
            value: part.dataGetContentTitle,
            fieldName: "dataGetContentTitle",
            partType: part.type,
          }),
          description: requireField({
            value: part.dataGetContentDescription,
            fieldName: "dataGetContentDescription",
            partType: part.type,
          }),
          status: requireField({
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
        id: requireField({
          value: part.dataCalculatorId,
          fieldName: "dataCalculatorId",
          partType: part.type,
        }),
        data: {
          original: requireField({
            value: part.dataCalculatorOriginal,
            fieldName: "dataCalculatorOriginal",
            partType: part.type,
          }),
          result: requireField({
            value: part.dataCalculatorResult,
            fieldName: "dataCalculatorResult",
            partType: part.type,
          }),
          status: requireField({
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
        id: requireField({
          value: part.dataScrapeUrlId,
          fieldName: "dataScrapeUrlId",
          partType: part.type,
        }),
        data: {
          url: requireField({
            value: part.dataScrapeUrlUrl,
            fieldName: "dataScrapeUrlUrl",
            partType: part.type,
          }),
          content: requireField({
            value: part.dataScrapeUrlContent,
            fieldName: "dataScrapeUrlContent",
            partType: part.type,
          }),
          status: requireField({
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
        id: requireField({
          value: part.dataWebSearchId,
          fieldName: "dataWebSearchId",
          partType: part.type,
        }),
        data: {
          query: requireField({
            value: part.dataWebSearchQuery,
            fieldName: "dataWebSearchQuery",
            partType: part.type,
          }),
          sources: requireField({
            value: part.dataWebSearchSources,
            fieldName: "dataWebSearchSources",
            partType: part.type,
          }),
          status: requireField({
            value: part.dataWebSearchStatus,
            fieldName: "dataWebSearchStatus",
            partType: part.type,
          }),
          error: part.dataWebSearchError,
        },
      };
    default: {
      throw new Error(`Unsupported part type: ${part.type}`);
    }
  }
}
