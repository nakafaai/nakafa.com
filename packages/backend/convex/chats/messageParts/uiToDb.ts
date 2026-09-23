import type { MyUIMessage, MyUIMessagePart } from "@repo/ai/types/message";
import { toPersistedProviderMetadata } from "@repo/backend/convex/chats/messageParts/providerMetadata";
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

/** Persists metadata shared by every replayable tool invocation. */
function toolFields(
  part: Extract<
    MyUIMessagePart,
    { type: "tool-nakafa" | "tool-deepResearch" | "tool-math" }
  >
) {
  const callMetadata = toPersistedProviderMetadata(part.callProviderMetadata);
  const resultMetadata =
    part.state === "output-available" || part.state === "output-error"
      ? toPersistedProviderMetadata(part.resultProviderMetadata)
      : undefined;
  return {
    toolToolCallId: part.toolCallId,
    toolState: requirePersistableToolState(part.state),
    ...(callMetadata === undefined
      ? {}
      : { toolCallProviderMetadata: callMetadata }),
    ...(resultMetadata === undefined
      ? {}
      : { toolResultProviderMetadata: resultMetadata }),
    ...(part.errorText === undefined ? {} : { toolErrorText: part.errorText }),
  };
}

/** Maps one AI SDK UI message part into the flattened Convex chat part row. */
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
        ...(part.state === undefined ? {} : { textState: part.state }),
      };
    case "reasoning": {
      const metadata = toPersistedProviderMetadata(part.providerMetadata);
      return {
        ...baseFields,
        type: part.type,
        reasoningText: part.text,
        ...(part.state === undefined ? {} : { reasoningState: part.state }),
        ...(metadata === undefined ? {} : { providerMetadata: metadata }),
      };
    }
    case "file":
      return {
        ...baseFields,
        type: part.type,
        fileMediaType: part.mediaType,
        ...(part.filename === undefined ? {} : { fileFilename: part.filename }),
        fileUrl: part.url,
      };
    case "step-start":
      return {
        ...baseFields,
        type: part.type,
      };
    case "tool-nakafa":
      return persistTool(part, order);
    case "tool-deepResearch":
      return persistTool(part, order);
    case "tool-math":
      return persistTool(part, order);
    case "data-suggestions":
      return {
        ...baseFields,
        type: part.type,
        ...(part.id === undefined ? {} : { dataSuggestionsId: part.id }),
        dataSuggestionsData: part.data.data,
      };
    case "data-nakafa":
      return {
        ...baseFields,
        type: part.type,
        ...(part.id === undefined ? {} : { dataNakafaId: part.id }),
        dataNakafaData: part.data,
      };
    case "data-math":
      return {
        ...baseFields,
        type: part.type,
        ...(part.id === undefined ? {} : { dataMathId: part.id }),
        dataMathData: part.data,
      };
    case "data-scrape-url":
      return persistWebData(part, order);
    case "data-web-search":
      return persistWebData(part, order);
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

/** Persists the tool invocation fields present in the UI message. */
function persistTool(
  part: Extract<
    MyUIMessagePart,
    { type: "tool-nakafa" | "tool-deepResearch" | "tool-math" }
  >,
  order: number
): DBPart {
  const baseFields = { order };
  switch (part.type) {
    case "tool-nakafa":
      return {
        ...baseFields,
        type: part.type,
        ...toolFields(part),
        ...(part.state === "input-streaming" || part.input === undefined
          ? {}
          : { toolNakafaInput: part.input }),
        ...(part.output === undefined ? {} : { toolNakafaOutput: part.output }),
      };
    case "tool-deepResearch":
      return {
        ...baseFields,
        type: part.type,
        ...toolFields(part),
        ...(part.state === "input-streaming" || part.input === undefined
          ? {}
          : { toolDeepResearchInput: part.input }),
        ...(part.output === undefined
          ? {}
          : { toolDeepResearchOutput: part.output }),
      };
    default:
      return {
        ...baseFields,
        type: part.type,
        ...toolFields(part),
        ...(part.state === "input-streaming" || part.input === undefined
          ? {}
          : { toolMathInput: part.input }),
        ...(part.output === undefined ? {} : { toolMathOutput: part.output }),
      };
  }
}

/** Persists the web evidence fields present in the UI message. */
function persistWebData(
  part: Extract<
    MyUIMessagePart,
    { type: "data-scrape-url" | "data-web-search" }
  >,
  order: number
): DBPart {
  const baseFields = { order };
  switch (part.type) {
    case "data-scrape-url":
      return {
        ...baseFields,
        type: part.type,
        ...(part.id === undefined ? {} : { dataScrapeUrlId: part.id }),
        dataScrapeUrlUrl: part.data.url,
        dataScrapeUrlContent: part.data.content,
        ...(part.data.title === undefined
          ? {}
          : { dataScrapeUrlTitle: part.data.title }),
        ...(part.data.description === undefined
          ? {}
          : { dataScrapeUrlDescription: part.data.description }),
        ...(part.data.favicon === undefined
          ? {}
          : { dataScrapeUrlFavicon: part.data.favicon }),
        dataScrapeUrlStatus: part.data.status,
        ...(part.data.error === undefined
          ? {}
          : { dataScrapeUrlError: part.data.error }),
      };
    default:
      return {
        ...baseFields,
        type: part.type,
        ...(part.id === undefined ? {} : { dataWebSearchId: part.id }),
        ...(part.data.provider === undefined
          ? {}
          : { dataWebSearchProvider: part.data.provider }),
        dataWebSearchQueries: part.data.queries,
        dataWebSearchSources: part.data.sources,
        dataWebSearchStatus: part.data.status,
        ...(part.data.error === undefined
          ? {}
          : { dataWebSearchError: part.data.error }),
      };
  }
}
