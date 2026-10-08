import { PaginationResult } from "@confect/core";
import { NinaTurnSummary } from "@repo/backend/confect/nina/conversation.spec";
import { Schema } from "effect";

/**
 * Agent message statuses: `streaming` for a live message, then the Agent
 * component's `pending`, `success`, and `failed`. The parity test checks the
 * component values against the installed Agent validators.
 */
export const AgentMessageStatus = Schema.Literals([
  "streaming",
  "pending",
  "success",
  "failed",
]);

/** Stream statuses stored by the Agent component. */
export const StreamStatus = Schema.Literals([
  "streaming",
  "finished",
  "aborted",
]);

/** Stream formats stored by the Agent component. */
export const StreamFormat = Schema.Literals([
  "UIMessageChunk",
  "TextStreamPart",
]);

/** Agent owns part decoding and delta assembly; Confect validates its envelope. */
export const AgentMessage = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  order: Schema.Finite,
  stepOrder: Schema.Finite,
  status: AgentMessageStatus,
  role: Schema.Literals(["user", "assistant", "system"]),
  text: Schema.String,
  parts: Schema.mutable(Schema.Array(Schema.Unknown)),
  metadata: Schema.optional(NinaTurnSummary),
  agentName: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
  _creationTime: Schema.Finite,
});

export const StreamRequest = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("list"),
    startOrder: Schema.optionalKey(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("deltas"),
    cursors: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          streamId: Schema.String,
          cursor: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
        })
      ).check(Schema.isMaxLength(100))
    ),
  }),
]);

const StreamMessage = Schema.Struct({
  streamId: Schema.String,
  status: StreamStatus,
  format: Schema.optional(StreamFormat),
  order: Schema.Finite,
  stepOrder: Schema.Finite,
  userId: Schema.optional(Schema.String),
  agentName: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  provider: Schema.optional(Schema.String),
  providerOptions: Schema.optional(
    Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown))
  ),
});

export const MessagePage = Schema.Struct({
  ...PaginationResult.PaginationResult(AgentMessage).fields,
  streams: Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("list"),
      messages: Schema.mutable(Schema.Array(StreamMessage)),
    }),
    Schema.Struct({
      kind: Schema.Literal("deltas"),
      deltas: Schema.mutable(
        Schema.Array(
          Schema.Struct({
            streamId: Schema.String,
            start: Schema.Finite,
            end: Schema.Finite,
            parts: Schema.mutable(Schema.Array(Schema.Unknown)),
          })
        )
      ),
    }),
  ]),
});
