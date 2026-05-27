import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { persistProviderMetadata } from "@repo/backend/confect/modules/chat/messageParts/providerMetadata";
import { failMessagePart } from "@repo/backend/confect/modules/chat/messageParts/shared";

type PersistedPartFields = Omit<
  Doc<"parts">,
  "_creationTime" | "_id" | "messageId"
>;

/** Narrows AI SDK tool states to the states persisted in Convex. */
function requirePersistableToolState(state: string) {
  switch (state) {
    case "input-streaming":
    case "input-available":
    case "output-available":
    case "output-error":
      return state;
    default:
      return failMessagePart(
        `Unsupported tool state for persistence: ${state}`
      );
  }
}

/** Reads result provider metadata only from tool result states. */
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

/** Converts one AI SDK UI message part into the persisted part shape. */
function mapUIMessagePartToDBPart(
  part: MyUIMessagePart,
  order: number
): PersistedPartFields {
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
        providerMetadata: persistProviderMetadata(part.providerMetadata),
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
        toolCallProviderMetadata: persistProviderMetadata(
          part.callProviderMetadata
        ),
        toolResultProviderMetadata: persistProviderMetadata(
          getToolResultProviderMetadata(part)
        ),
        toolNakafaInput:
          part.state === "input-streaming" ? undefined : part.input,
        toolNakafaOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "tool-deepResearch":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolCallProviderMetadata: persistProviderMetadata(
          part.callProviderMetadata
        ),
        toolResultProviderMetadata: persistProviderMetadata(
          getToolResultProviderMetadata(part)
        ),
        toolDeepResearchInput:
          part.state === "input-streaming" ? undefined : part.input,
        toolDeepResearchOutput: part.output,
        toolErrorText: part.errorText,
      };
    case "tool-math":
      return {
        ...baseFields,
        type: part.type,
        toolToolCallId: part.toolCallId,
        toolState: requirePersistableToolState(part.state),
        toolCallProviderMetadata: persistProviderMetadata(
          part.callProviderMetadata
        ),
        toolResultProviderMetadata: persistProviderMetadata(
          getToolResultProviderMetadata(part)
        ),
        toolMathInput:
          part.state === "input-streaming" ? undefined : part.input,
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
      return failMessagePart(
        `Unsupported part type for persistence: ${JSON.stringify(part)}`
      );
  }
}

/** Converts AI SDK message parts into the persisted Convex part shape. */
function mapUIMessagePartsToDBParts({
  messageParts,
}: {
  readonly messageParts: readonly MyUIMessagePart[];
}) {
  return messageParts.map((part, index) =>
    mapUIMessagePartToDBPart(part, index)
  );
}

export { mapUIMessagePartsToDBParts };
