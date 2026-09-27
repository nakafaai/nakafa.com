import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  ChatTurnError,
  chatTurnValidator,
} from "@repo/backend/confect/chats/turns/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { ModelIdSchema } from "@repo/backend/confect/nina/config/model";
import {
  NinaPageSchema,
  NinaUserSchema,
} from "@repo/backend/confect/nina/contract/turn";
import {
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/backend/confect/nina/memory/pack";
import { NinaSuggestions } from "@repo/backend/confect/nina/presentation.spec";
import {
  NINA_FILE_COUNT,
  NinaUploadError,
} from "@repo/backend/confect/nina/uploads.spec";
import { NinaUsageTotal } from "@repo/backend/confect/nina/usage.spec";
import { LocaleSchema } from "@repo/contents/content";
import { Schema } from "effect";

export const NinaPageInput = Schema.Struct({
  locale: LocaleSchema,
  slug: Schema.String.pipe(Schema.check(Schema.isMaxLength(2048))),
  materialContextHint: Schema.optionalKey(Schema.String),
});

export const NinaPrompt = Schema.Struct({
  text: Schema.NonEmptyString.pipe(Schema.check(Schema.isMaxLength(100_000))),
  uploadIds: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(Id("ninaUploads")).check(Schema.isMaxLength(NINA_FILE_COUNT))
    )
  ),
});

export const NinaInput = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("message"),
    prompt: NinaPrompt,
    page: NinaPageInput,
  }),
  Schema.Struct({
    kind: Schema.Literal("retry"),
    page: Schema.optionalKey(NinaPageInput),
    order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
]);

/** Safe response failure facts, independent of provider diagnostics and UI language. */
export const NinaFailureReason = Schema.Literals([
  "provider-busy",
  "provider-unavailable",
  "service-configuration",
  "request-rejected",
  "input-too-large",
  "response-timeout",
  "content-blocked",
  "response-limit",
  "interrupted",
  "unknown",
]);

export const NinaTurnState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("queued") }),
  Schema.Struct({
    status: Schema.Literal("running"),
    startedAt: Schema.Finite,
  }),
  Schema.Struct({
    status: Schema.Literal("complete"),
    finishedAt: Schema.Finite,
  }),
  Schema.Struct({
    status: Schema.Literal("failed"),
    finishedAt: Schema.Finite,
    reason: Schema.optionalKey(NinaFailureReason),
  }),
  Schema.Struct({
    status: Schema.Literal("cancelled"),
    finishedAt: Schema.Finite,
  }),
  Schema.Struct({ status: Schema.Literal("unanswered") }),
]);

/** A request key survives settlement so network retries remain idempotent. */
export const NinaRequestId = Schema.NonEmptyString.check(
  Schema.isMaxLength(128)
);

/** Recorded response facts never invent an unknown model, charge or token count. */
export const NinaTurnFacts = Schema.Struct({
  userId: Id("users"),
  chatId: Id("chats"),
  threadId: Schema.String,
  promptMessageId: Schema.String,
  promptedAt: Schema.optionalKey(Schema.Finite),
  order: Schema.Finite,
  modelId: Schema.optionalKey(ModelIdSchema),
  credits: Schema.optionalKey(Schema.Finite),
  requestId: Schema.optionalKey(NinaRequestId),
  fingerprint: Schema.optionalKey(Schema.String),
  transactionId: Schema.optionalKey(Id("creditTransactions")),
  page: Schema.optionalKey(NinaPageSchema),
  user: Schema.optionalKey(NinaUserSchema),
  snapshot: Schema.optionalKey(NinaContextSnapshotSchema),
  transition: Schema.optionalKey(NinaContextTransitionSchema),
  tokens: Schema.optionalKey(
    Schema.Struct({
      input: Schema.optionalKey(Schema.Finite),
      output: Schema.optionalKey(Schema.Finite),
      total: Schema.optionalKey(Schema.Finite),
    })
  ),
  usage: Schema.Array(NinaUsageTotal).check(Schema.isMaxLength(32)),
  suggestions: Schema.optionalKey(NinaSuggestions),
});

/** Only active generation owns a refundable reservation and verified run context. */
export const NinaActiveTurn = Schema.Struct({
  ...NinaTurnFacts.fields,
  ...chatTurnValidator.fields,
  phase: Schema.Literal("active"),
  modelId: ModelIdSchema,
  requestId: NinaRequestId,
  fingerprint: Schema.String,
  page: NinaPageSchema,
  user: NinaUserSchema,
  state: Schema.Union([NinaTurnState.members[0], NinaTurnState.members[1]]),
});

export const NinaSettledTurn = Schema.Struct({
  ...NinaTurnFacts.fields,
  phase: Schema.Literal("settled"),
  state: Schema.Union([
    NinaTurnState.members[2],
    NinaTurnState.members[3],
    NinaTurnState.members[4],
  ]),
});

/** A saved prompt without a response has no inferred charge or completion time. */
export const NinaUnansweredTurn = Schema.Struct({
  ...NinaTurnFacts.fields,
  phase: Schema.Literal("unanswered"),
  state: NinaTurnState.members[5],
});

export const NinaTurn = Schema.Union([
  NinaActiveTurn,
  NinaSettledTurn,
  NinaUnansweredTurn,
]);

export class NinaTurnError extends Schema.TaggedError<NinaTurnError>()(
  "NinaTurnError",
  {
    code: Schema.Literals([
      "NINA_BUSY",
      "NINA_RETRY_UNAVAILABLE",
      "NINA_REQUEST_CONFLICT",
      "NINA_HISTORY_PENDING",
      "NINA_WRITE_FAILED",
      "NINA_CONTEXT_FAILED",
    ]),
    message: Schema.String,
  }
) {}

/** Committed prompt presentation used while the first reactive page arrives. */
export const NinaPromptPreview = Schema.Struct({
  text: Schema.String,
  files: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        type: Schema.Literal("file"),
        url: Schema.String,
        mediaType: Schema.String,
        filename: Schema.optional(Schema.String),
      })
    )
  ),
});

export const NinaReceipt = Schema.Struct({
  prompt: NinaPromptPreview,
  chatId: Id("chats"),
  threadId: Schema.String,
  turnId: Id("ninaTurns"),
  promptMessageId: Schema.String,
  order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "start",
    args: () => ({
      chatId: Schema.optionalKey(Id("chats")),
      requestId: NinaRequestId,
      modelId: ModelIdSchema,
      input: NinaInput,
    }),
    returns: () => NinaReceipt,
    error: () =>
      Schema.Union([
        AuthFailure,
        ChatAccessError,
        ChatTurnError,
        NinaTurnError,
        NinaUploadError,
      ]),
  })
    .middleware(Session)
    .middleware(Atomic)
);
