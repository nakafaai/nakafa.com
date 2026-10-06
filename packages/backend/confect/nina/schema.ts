import { PaginationResult } from "@confect/core";
import type { UIMessage } from "@convex-dev/agent/react";
import { vMessageStatus, vStreamMessage } from "@convex-dev/agent/validators";
import { NinaTurnSummary } from "@repo/backend/confect/nina/conversation.spec";
import { Array as Arr, Schema } from "effect";

export type NinaMessage = UIMessage<typeof NinaTurnSummary.Type>;

/** Agent owns part decoding and delta assembly; Confect validates its envelope. */
export const AgentMessage = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  order: Schema.Finite,
  stepOrder: Schema.Finite,
  status: Schema.Literals([
    "streaming",
    ...Arr.map(vMessageStatus.members, (status) => status.value),
  ]),
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
  status: Schema.Literals(
    Arr.map(vStreamMessage.fields.status.members, (status) => status.value)
  ),
  format: Schema.optional(
    Schema.Literals(
      Arr.map(vStreamMessage.fields.format.members, (format) => format.value)
    )
  ),
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
