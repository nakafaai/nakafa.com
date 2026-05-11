import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  requirePartField,
  requireToolState,
} from "@repo/backend/convex/chats/messageParts/shared";
import {
  type MathData,
  MathDataSchema,
  MathExpressionSchema,
  MathItemSchema,
  MathOperationSchema,
  type MathRequest,
  MathRequestSchema,
  MathStatusSchema,
} from "@repo/math/schema";
import { ConvexError } from "convex/values";
import { Schema } from "effect";

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

const isCurrentMathData = Schema.is(MathDataSchema);

const legacyCurrentMathResultSchema = Schema.Struct({
  conditions: Schema.Array(Schema.String).pipe(Schema.mutable),
  input: MathRequestSchema,
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  kind: MathOperationSchema,
  operation: MathOperationSchema,
  primary: MathExpressionSchema,
  reason: Schema.String,
  secondary: Schema.optional(MathExpressionSchema),
  status: MathStatusSchema,
}).pipe(Schema.mutable);

const legacyCurrentMathDataSchema = Schema.Struct({
  input: MathRequestSchema,
  kind: MathOperationSchema,
  result: legacyCurrentMathResultSchema,
  status: MathStatusSchema,
  summary: Schema.String,
}).pipe(Schema.mutable);

const isLegacyCurrentMathData = Schema.is(legacyCurrentMathDataSchema);

const previousMathExpressionInputSchema = Schema.Struct({
  expression: Schema.String,
  variable: Schema.optional(Schema.String),
}).pipe(Schema.mutable);

const previousMathOutputSchema = Schema.Struct({
  expression: Schema.String,
  latex: Schema.String,
  value: Schema.optional(Schema.String),
}).pipe(Schema.mutable);

const previousExpressionMathDataSchema = Schema.Struct({
  input: previousMathExpressionInputSchema,
  kind: Schema.Literal("evaluate", "simplify", "differentiate"),
  result: Schema.Struct({
    input: MathExpressionSchema,
    output: previousMathOutputSchema,
    variable: Schema.optional(Schema.String),
  }).pipe(Schema.mutable),
  status: Schema.Literal("verified"),
  summary: Schema.String,
}).pipe(Schema.mutable);

const previousMathSampleSchema = Schema.Struct({
  left: Schema.String,
  right: Schema.String,
  scope: Schema.Record({ key: Schema.String, value: Schema.Number }),
}).pipe(Schema.mutable);

const previousCompareMathDataSchema = Schema.Struct({
  input: Schema.Struct({
    left: Schema.String,
    right: Schema.String,
  }).pipe(Schema.mutable),
  kind: Schema.Literal("compare"),
  result: Schema.Struct({
    left: MathExpressionSchema,
    reason: Schema.String,
    right: MathExpressionSchema,
    samples: Schema.Array(previousMathSampleSchema).pipe(Schema.mutable),
    status: MathStatusSchema,
  }).pipe(Schema.mutable),
  status: MathStatusSchema,
  summary: Schema.String,
}).pipe(Schema.mutable);

const isPreviousExpressionMathData = Schema.is(
  previousExpressionMathDataSchema
);
const isPreviousCompareMathData = Schema.is(previousCompareMathDataSchema);

function normalizeMathData(
  data: NonNullable<Doc<"parts">["dataMathData"]>
): MathData {
  if (isCurrentMathData(data)) {
    return data;
  }

  if (data.status === "loading") {
    return {
      input: toMathRequest(data),
      kind: data.kind,
      status: data.status,
    } satisfies MathData;
  }

  if (data.status === "error") {
    return {
      error: data.error,
      input: toMathRequest(data),
      kind: data.kind,
      status: data.status,
    } satisfies MathData;
  }

  if (isLegacyCurrentMathData(data)) {
    return {
      input: data.input,
      kind: data.kind,
      result: {
        ...data.result,
        conditions: data.result.conditions.map(toMathExpression),
        stepStatus: "unavailable",
        steps: [],
      },
      status: data.status,
      summary: data.summary,
    } satisfies MathData;
  }

  if (isPreviousCompareMathData(data)) {
    return normalizePreviousCompareMathData(data);
  }

  if (isPreviousExpressionMathData(data)) {
    const input = toMathRequest(data);

    return {
      input,
      kind: data.kind,
      status: data.status,
      result: {
        conditions: [],
        input,
        items: [],
        kind: data.kind,
        operation: data.kind,
        primary: data.result.input,
        reason: data.summary,
        secondary: data.result.output,
        stepStatus: "unavailable",
        steps: [],
        status: data.status,
      },
      summary: data.summary,
    } satisfies MathData;
  }

  throw new ConvexError({
    code: "CHAT_MATH_DATA_UNSUPPORTED",
    message: "Unsupported persisted math data shape.",
  });
}

function normalizePreviousCompareMathData(
  data: Schema.Schema.Type<typeof previousCompareMathDataSchema>
) {
  const input = toMathRequest(data);

  return {
    input,
    kind: data.kind,
    result: {
      conditions: [],
      input,
      items: data.result.samples.map((sample) => ({
        label: "counterexample",
        value: `${sample.left} != ${sample.right}`,
      })),
      kind: data.kind,
      operation: data.kind,
      primary: data.result.left,
      reason: data.result.reason,
      secondary: data.result.right,
      stepStatus: "unavailable",
      steps: [],
      status: data.status,
    },
    status: data.status,
    summary: data.summary,
  } satisfies MathData;
}

function toMathRequest(data: NonNullable<Doc<"parts">["dataMathData"]>) {
  switch (data.kind) {
    case "compare":
      return {
        kind: "math",
        left: data.input.left,
        operation: data.kind,
        right: data.input.right,
      } satisfies MathRequest;
    case "differentiate":
      return {
        expression: data.input.expression,
        kind: "math",
        operation: data.kind,
        variable: data.input.variable,
      } satisfies MathRequest;
    default:
      return {
        expression: data.input.expression,
        kind: "math",
        operation: data.kind,
      } satisfies MathRequest;
  }
}

function toMathExpression(value: string) {
  return {
    expression: value,
    latex: value,
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
            input: requireToolInputQuery(part, "toolNakafaInput"),
            output: requirePartField({
              value: part.toolNakafaOutput,
              fieldName: "toolNakafaOutput",
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
            input: requireToolInputQuery(part, "toolNakafaInput"),
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
            input: requireToolInputQuery(part, "toolMathInput"),
            output: requirePartField({
              value: part.toolMathOutput,
              fieldName: "toolMathOutput",
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
            input: requireToolInputQuery(part, "toolMathInput"),
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
        data: normalizeMathData(
          requirePartField({
            value: part.dataMathData,
            fieldName: "dataMathData",
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
