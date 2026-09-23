import { NakafaDataSchema } from "@repo/ai/schema/data";
import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  requirePartField,
  requireToolState,
} from "@repo/backend/convex/chats/messageParts/shared";
import { Schema, Struct } from "effect";

/** Rebuild one UI message part from the flattened persisted part row. */
export function mapDBPartToUIMessagePart({
  part,
}: {
  part: Doc<"messageParts">;
}): MyUIMessagePart {
  // biome-ignore lint/style/useDefaultSwitchClause: The persisted validator closes this union; TypeScript checks exhaustive returns.
  switch (part.type) {
    case "text":
      return {
        type: part.type,
        text: requirePartField({
          value: part.textText,
          fieldName: "textText",
          partType: part.type,
        }),
        ...Struct.renameKeys(Struct.pick(part, ["textState"]), {
          textState: "state",
        }),
      };
    case "reasoning":
      return {
        type: part.type,
        text: requirePartField({
          value: part.reasoningText,
          fieldName: "reasoningText",
          partType: part.type,
        }),
        ...Struct.renameKeys(Struct.pick(part, ["reasoningState"]), {
          reasoningState: "state",
        }),
        ...Struct.pick(part, ["providerMetadata"]),
      };
    case "file":
      return {
        type: part.type,
        mediaType: requirePartField({
          value: part.fileMediaType,
          fieldName: "fileMediaType",
          partType: part.type,
        }),
        ...Struct.renameKeys(Struct.pick(part, ["fileFilename"]), {
          fileFilename: "filename",
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
    case "tool-nakafa":
      return readNakafaTool(part);
    case "tool-deepResearch":
      return readResearchTool(part);
    case "tool-math":
      return readMathTool(part);
    case "data-suggestions":
      return {
        type: part.type,
        ...Struct.renameKeys(Struct.pick(part, ["dataSuggestionsId"]), {
          dataSuggestionsId: "id",
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
        ...Struct.renameKeys(Struct.pick(part, ["dataNakafaId"]), {
          dataNakafaId: "id",
        }),
        data: Schema.decodeUnknownSync(NakafaDataSchema)(
          projectPersistedNakafaData(
            requirePartField({
              value: part.dataNakafaData,
              fieldName: "dataNakafaData",
              partType: part.type,
            })
          )
        ),
      };
    case "data-math":
      return {
        type: part.type,
        ...Struct.renameKeys(Struct.pick(part, ["dataMathId"]), {
          dataMathId: "id",
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
        ...Struct.renameKeys(Struct.pick(part, ["dataScrapeUrlId"]), {
          dataScrapeUrlId: "id",
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
        ...Struct.renameKeys(Struct.pick(part, ["dataWebSearchId"]), {
          dataWebSearchId: "id",
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
  }
}

type PersistedNakafaData = NonNullable<Doc<"messageParts">["dataNakafaData"]>;

/** Projects persisted predecessor Quran previews into the canonical UI shape. */
function projectPersistedNakafaData(data: PersistedNakafaData): unknown {
  if (
    data.kind !== "quran" ||
    data.status !== "done" ||
    !("translation" in data.result)
  ) {
    return data;
  }
  const { translation, ...result } = data.result;
  return {
    ...data,
    result: {
      ...result,
      meaning: { locale: "en", text: translation },
    },
  };
}

/** Rebuilds the persisted tool-nakafa invocation at its recorded state. */
function readNakafaTool(
  part: Doc<"messageParts">
): Extract<MyUIMessagePart, { type: "tool-nakafa" }> {
  const toolState = requireToolState(part);
  const fields = readToolFields(part);
  // biome-ignore lint/style/useDefaultSwitchClause: The persisted validator closes this union; TypeScript checks exhaustive returns.
  switch (toolState) {
    case "input-streaming":
      return {
        type: "tool-nakafa",
        state: toolState,
        ...fields,
        input: part.toolNakafaInput,
      };
    case "input-available":
      return {
        type: "tool-nakafa",
        state: toolState,
        ...fields,
        input: requirePartField({
          value: part.toolNakafaInput,
          fieldName: "toolNakafaInput",
          partType: part.type,
        }),
      };
    case "output-available":
      return {
        type: "tool-nakafa",
        state: toolState,
        ...fields,
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
        ...Struct.renameKeys(
          Struct.pick(part, ["toolResultProviderMetadata"]),
          { toolResultProviderMetadata: "resultProviderMetadata" }
        ),
      };
    case "output-error":
      return {
        type: "tool-nakafa",
        state: toolState,
        ...fields,
        input: part.toolNakafaInput,
        errorText: requirePartField({
          value: part.toolErrorText,
          fieldName: "toolErrorText",
          partType: part.type,
        }),
        ...Struct.renameKeys(
          Struct.pick(part, ["toolResultProviderMetadata"]),
          { toolResultProviderMetadata: "resultProviderMetadata" }
        ),
      };
  }
}

/** Rebuilds the persisted tool-deepResearch invocation at its recorded state. */
function readResearchTool(
  part: Doc<"messageParts">
): Extract<MyUIMessagePart, { type: "tool-deepResearch" }> {
  const toolState = requireToolState(part);
  const fields = readToolFields(part);
  // biome-ignore lint/style/useDefaultSwitchClause: The persisted validator closes this union; TypeScript checks exhaustive returns.
  switch (toolState) {
    case "input-streaming":
      return {
        type: "tool-deepResearch",
        state: toolState,
        ...fields,
        input: part.toolDeepResearchInput,
      };
    case "input-available":
      return {
        type: "tool-deepResearch",
        state: toolState,
        ...fields,
        input: requirePartField({
          value: part.toolDeepResearchInput,
          fieldName: "toolDeepResearchInput",
          partType: part.type,
        }),
      };
    case "output-available":
      return {
        type: "tool-deepResearch",
        state: toolState,
        ...fields,
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
        ...Struct.renameKeys(
          Struct.pick(part, ["toolResultProviderMetadata"]),
          { toolResultProviderMetadata: "resultProviderMetadata" }
        ),
      };
    case "output-error":
      return {
        type: "tool-deepResearch",
        state: toolState,
        ...fields,
        input: part.toolDeepResearchInput,
        errorText: requirePartField({
          value: part.toolErrorText,
          fieldName: "toolErrorText",
          partType: part.type,
        }),
        ...Struct.renameKeys(
          Struct.pick(part, ["toolResultProviderMetadata"]),
          { toolResultProviderMetadata: "resultProviderMetadata" }
        ),
      };
  }
}

/** Rebuilds the persisted tool-math invocation at its recorded state. */
function readMathTool(
  part: Doc<"messageParts">
): Extract<MyUIMessagePart, { type: "tool-math" }> {
  const toolState = requireToolState(part);
  const fields = readToolFields(part);
  // biome-ignore lint/style/useDefaultSwitchClause: The persisted validator closes this union; TypeScript checks exhaustive returns.
  switch (toolState) {
    case "input-streaming":
      return {
        type: "tool-math",
        state: toolState,
        ...fields,
        input: part.toolMathInput,
      };
    case "input-available":
      return {
        type: "tool-math",
        state: toolState,
        ...fields,
        input: requirePartField({
          value: part.toolMathInput,
          fieldName: "toolMathInput",
          partType: part.type,
        }),
      };
    case "output-available":
      return {
        type: "tool-math",
        state: toolState,
        ...fields,
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
        ...Struct.renameKeys(
          Struct.pick(part, ["toolResultProviderMetadata"]),
          { toolResultProviderMetadata: "resultProviderMetadata" }
        ),
      };
    case "output-error":
      return {
        type: "tool-math",
        state: toolState,
        ...fields,
        input: part.toolMathInput,
        errorText: requirePartField({
          value: part.toolErrorText,
          fieldName: "toolErrorText",
          partType: part.type,
        }),
        ...Struct.renameKeys(
          Struct.pick(part, ["toolResultProviderMetadata"]),
          { toolResultProviderMetadata: "resultProviderMetadata" }
        ),
      };
  }
}

/** Reconstructs shared invocation identity and optional provider metadata. */
function readToolFields(part: Doc<"messageParts">) {
  return {
    toolCallId: requirePartField({
      value: part.toolToolCallId,
      fieldName: "toolToolCallId",
      partType: part.type,
    }),
    ...Struct.renameKeys(Struct.pick(part, ["toolCallProviderMetadata"]), {
      toolCallProviderMetadata: "callProviderMetadata",
    }),
  };
}
