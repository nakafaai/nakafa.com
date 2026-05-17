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

/** Returns tool result provider metadata only for tool states that carry it. */
function getToolResultProviderMetadata(part: MyUIMessagePart) {
  if (
    part.type !== "tool-nakafa" &&
    part.type !== "tool-deepResearch" &&
    part.type !== "tool-math"
  ) {
    return;
  }

  switch (part.state) {
    case "output-available":
    case "output-error":
      return part.resultProviderMetadata;
    default:
      return;
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
    case "step-start":
      return {
        ...baseFields,
        type: part.type,
      };
    case "tool-nakafa":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolCallProviderMetadata: part.callProviderMetadata,
        toolResultProviderMetadata: getToolResultProviderMetadata(part),
        toolNakafaInput: part.input?.task,
        toolNakafaOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "tool-deepResearch":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolCallProviderMetadata: part.callProviderMetadata,
        toolResultProviderMetadata: getToolResultProviderMetadata(part),
        toolDeepResearchInput: part.input?.task,
        toolDeepResearchOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "tool-math":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolCallProviderMetadata: part.callProviderMetadata,
        toolResultProviderMetadata: getToolResultProviderMetadata(part),
        toolMathInput: part.input?.task,
        toolMathOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "data-suggestions":
      return {
        ...baseFields,
        type: part.type,
        dataSuggestionsId: part.id,
        dataSuggestionsData: part.data.data,
      };
    case "data-nakafa":
      return {
        ...baseFields,
        type: part.type,
        dataNakafaId: part.id,
        dataNakafaData: part.data,
      };
    case "data-math":
      return {
        ...baseFields,
        type: part.type,
        dataMathId: part.id,
        dataMathData: part.data,
      };
    case "data-scrape-url":
      return {
        ...baseFields,
        type: part.type,
        dataScrapeUrlId: part.id,
        dataScrapeUrlUrl: part.data.url,
        dataScrapeUrlContent: part.data.content,
        dataScrapeUrlTitle: part.data.title,
        dataScrapeUrlDescription: part.data.description,
        dataScrapeUrlFavicon: part.data.favicon,
        dataScrapeUrlStatus: part.data.status,
        dataScrapeUrlError: part.data.error,
      };
    case "data-web-search":
      return {
        ...baseFields,
        type: part.type,
        dataWebSearchId: part.id,
        dataWebSearchProvider: part.data.provider,
        dataWebSearchQueries: part.data.queries,
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
