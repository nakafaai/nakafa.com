import { PaginationResult } from "@confect/core";
import { Schema } from "effect";

/**
 * Agent message statuses: `streaming` for a live message, then the Agent
 * component's `pending`, `success`, and `failed`. The parity test checks the
 * values of the page schema against the installed Agent validators.
 */
const AgentMessageStatus = Schema.Literals([
  "streaming",
  "pending",
  "success",
  "failed",
]);

/** Stream statuses stored by the Agent component. */
const StreamStatus = Schema.Literals(["streaming", "finished", "aborted"]);

/** Stream formats stored by the Agent component. */
const StreamFormat = Schema.Literals(["UIMessageChunk", "TextStreamPart"]);

/**
 * Agent owns part decoding and delta assembly; Confect validates its envelope.
 * A message holds nothing of its turn: `conversation.turns` tells where a turn
 * stands and what it cost.
 */
const AgentMessage = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  order: Schema.Finite,
  stepOrder: Schema.Finite,
  status: AgentMessageStatus,
  role: Schema.Literals(["user", "assistant", "system"]),
  text: Schema.String,
  parts: Schema.mutable(Schema.Array(Schema.Unknown)),
  agentName: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
  _creationTime: Schema.Finite,
});

/**
 * Characters the id of a row of the Agent component holds at most. A caller
 * names such a row, a thread or a stream, as text, because this app's schema
 * does not hold the component's tables. A Convex document id is at most 23
 * bytes (a table number of up to 5 bytes, 16 bytes of id and a 2 byte
 * checksum), which its base32 writes in 37 characters (`id_v6.rs` and
 * `base32.rs` in get-convex/convex-backend).
 */
export const AGENT_ID_LENGTH = 37;

/** The id of a thread or a stream of the Agent component, as a caller names it. */
export const AgentId = Schema.String.check(Schema.isMaxLength(AGENT_ID_LENGTH));

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
          streamId: AgentId,
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
