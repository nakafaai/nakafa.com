import type { MyUIMessage, MyUIMessagePart } from "@repo/ai/types/message";
import type { DBPart } from "@repo/backend/convex/chats/messageParts/shared";
import type { ToolState } from "@repo/backend/convex/chats/schema";
import { ConvexError } from "convex/values";

/** Only persist tool states the flattened chat schema can reconstruct. */
function requirePersistableToolState(state: string): ToolState {
  switch (state) {
    case "input-streaming":
    case "input-available":
    case "output-available":
    case "output-error":
      return state;
    default:
      throw new ConvexError({
        code: "CHAT_TOOL_STATE_UNSUPPORTED",
        message: `Unsupported tool state for persistence: ${state}`,
      });
  }
}

function mapUIMessagePartToDBPart(
  part: MyUIMessagePart,
  order: number
): DBPart {
  const baseFields = { order };

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
    case "tool-contentAccess":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolContentAccessInput: part.input?.query,
        toolContentAccessOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "tool-deepResearch":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolDeepResearchInput: part.input?.query,
        toolDeepResearchOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "tool-mathCalculation":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolMathCalculationInput: part.input?.query,
        toolMathCalculationOutput: part.output,
        toolErrorText: part.errorText,
      };
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
    default:
      throw new ConvexError({
        code: "CHAT_PART_TYPE_UNSUPPORTED",
        message: `Unsupported part type for persistence: ${JSON.stringify(part)}`,
      });
  }
}

/** Flatten UI message parts into persisted chat part rows. */
export function mapUIMessagePartsToDBParts({
  messageParts,
}: {
  messageParts: MyUIMessage["parts"];
}): DBPart[] {
  return messageParts.map((part, index) =>
    mapUIMessagePartToDBPart(part, index)
  );
}
