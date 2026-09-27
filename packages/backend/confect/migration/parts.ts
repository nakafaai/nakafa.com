import { fromUIMessages, type UIMessage } from "@convex-dev/agent";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { MyUIMessagePart } from "@repo/backend/confect/chats/message";
import { mapDBPartToUIMessagePart } from "@repo/backend/confect/chats/messageParts/dbToUi";
import { CapabilityOutputSchema } from "@repo/backend/confect/nina/capability/progress";
import { Effect, Schema } from "effect";

export class NinaMigrationError extends Schema.TaggedError<NinaMigrationError>()(
  "NinaMigrationError",
  { message: Schema.String, cause: Schema.Unknown }
) {}
const conversionFailure = (cause: unknown) =>
  new NinaMigrationError({
    message: "The stored transcript cannot be converted without loss.",
    cause,
  });

/** One-off conversion to Agent's ordinary tool-result contract. Remove after cutover. */
function normalizePart(part: MyUIMessagePart, id: string): UIMessage["parts"] {
  if (part.type === "data-suggestions" || part.type === "step-start") {
    return [];
  }
  if (
    part.type === "tool-nakafa" ||
    part.type === "tool-math" ||
    part.type === "tool-deepResearch"
  ) {
    if (part.state !== "output-available") {
      return [part];
    }
    return [{ ...part, output: { text: part.output, artifacts: [] } }];
  }
  if (
    part.type === "data-math" ||
    part.type === "data-nakafa" ||
    part.type === "data-web-search" ||
    part.type === "data-scrape-url"
  ) {
    const artifact = { ...part, id: part.id ?? id };
    const output = Schema.encodeSync(CapabilityOutputSchema)({
      text: JSON.stringify(part.data),
      artifacts: [artifact],
    });
    // These rows are recorded tool executions, including their real inputs and results.
    const { input, toolName } = toolInput(part);
    return [
      {
        type: "dynamic-tool",
        toolName,
        toolCallId: id,
        state: "output-available",
        input,
        output,
      },
    ];
  }
  return [part];
}

function toolInput(
  part: Extract<
    MyUIMessagePart,
    {
      type: "data-math" | "data-nakafa" | "data-web-search" | "data-scrape-url";
    }
  >
) {
  if (part.type === "data-web-search") {
    return { input: { queries: part.data.queries }, toolName: "webSearch" };
  }
  if (part.type === "data-scrape-url") {
    return { input: { url: part.data.url }, toolName: "scrapeUrl" };
  }
  return { input: part.data.input, toolName: part.data.kind };
}

export const projectTranscript = Effect.fn("migration.nina.project")(function* (
  message: Docs["messages"],
  parts: readonly Docs["messageParts"][],
  threadId: string,
  userId: string
) {
  const projected = yield* Effect.try({
    try: () =>
      parts.map((part) => ({
        row: part,
        ui: mapDBPartToUIMessagePart({ part }),
      })),
    catch: conversionFailure,
  });
  const normalized = yield* Effect.try({
    try: () => projected.flatMap(({ row, ui }) => normalizePart(ui, row._id)),
    catch: conversionFailure,
  });
  const rows = yield* Effect.tryPromise({
    try: () =>
      fromUIMessages(
        [
          {
            id: message.identifier,
            key: message.identifier,
            role: message.role,
            parts: normalized,
            text: "",
            order: 0,
            stepOrder: 0,
            status: "success",
            _creationTime: message._creationTime,
          },
        ],
        { threadId, userId }
      ),
    catch: conversionFailure,
  });
  const suggestions = projected.flatMap(({ ui }) =>
    ui.type === "data-suggestions" ? ui.data.data : []
  );
  const failedCalls = new Set(
    normalized.flatMap((part) =>
      "state" in part && part.state === "output-error" ? [part.toolCallId] : []
    )
  );
  type Row = (typeof rows)[number];
  const converted: (Row & { message: NonNullable<Row["message"]> })[] = [];
  for (const row of rows) {
    if (!row.message) {
      return yield* conversionFailure(
        "Agent returned a row without its message."
      );
    }
    if (row.message.role === "tool") {
      row.message.content = row.message.content.map((part) =>
        part.type === "tool-result" && failedCalls.has(part.toolCallId)
          ? { ...part, isError: true }
          : part
      );
    }
    converted.push({ ...row, message: row.message });
  }
  return { rows: converted, suggestions };
});
