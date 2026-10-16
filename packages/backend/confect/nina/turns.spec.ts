import { FunctionSpec, GroupSpec } from "@confect/core";
import { NinaPromptError } from "@repo/backend/client/nina/prompt";
import { NinaReceipt } from "@repo/backend/client/nina/receipt";
import {
  NINA_FILE_COUNT,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { NinaFocusInputSchema } from "@repo/backend/confect/nina/contract/focus";
import {
  NinaCancelledState,
  NinaCompleteState,
  NinaFailedState,
  NinaPageSchema,
  NinaQueuedState,
  NinaRequestId,
  NinaRunningState,
  NinaTurnFacts,
  NinaUserSchema,
} from "@repo/backend/confect/nina/contract/turn";
import {
  NinaCreditError,
  NinaCreditHold,
} from "@repo/backend/confect/nina/credits/schema";
import { LocaleSchema } from "@repo/contents/content";
import { Schema } from "effect";

export const NinaPageInput = Schema.Struct({
  locale: LocaleSchema,
  slug: Schema.String.pipe(Schema.check(Schema.isMaxLength(2048))),
  materialContextHint: Schema.optionalKey(Schema.String),
  focus: Schema.optionalKey(NinaFocusInputSchema),
});

/**
 * The prompt limit is not part of this schema. A value the schema refuses
 * reaches the learner as an untyped server failure, so `start` checks the
 * length itself and refuses with `NinaPromptError`.
 */
export const NinaPrompt = Schema.Struct({
  text: Schema.NonEmptyString,
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

/**
 * Only active generation owns a refundable reservation and verified run
 * context. `cancelRequestedAt` is set when the learner stops a running turn.
 * The page shows the turn as cancelled from then on, and the turn settles when
 * its run has exited, after the stop grace, or when the learner sends the next
 * prompt, whichever comes first.
 */
const NinaActiveTurn = Schema.Struct({
  ...NinaTurnFacts.fields,
  ...NinaCreditHold.fields,
  phase: Schema.Literal("active"),
  requestId: NinaRequestId,
  fingerprint: Schema.String,
  page: NinaPageSchema,
  user: NinaUserSchema,
  state: Schema.Union([NinaQueuedState, NinaRunningState]),
  cancelRequestedAt: Schema.optionalKey(Schema.Finite),
});

export const NinaSettledTurn = Schema.Struct({
  ...NinaTurnFacts.fields,
  phase: Schema.Literal("settled"),
  state: Schema.Union([NinaCompleteState, NinaFailedState, NinaCancelledState]),
});

export const NinaTurn = Schema.Union([NinaActiveTurn, NinaSettledTurn]);

export class NinaTurnError extends Schema.TaggedError<NinaTurnError>()(
  "NinaTurnError",
  {
    code: Schema.Literals([
      "NINA_BUSY",
      "NINA_RETRY_UNAVAILABLE",
      "NINA_REQUEST_CONFLICT",
      "NINA_WRITE_FAILED",
      "NINA_CONTEXT_FAILED",
      "NINA_MESSAGE_SIZE",
    ]),
    message: Schema.String,
  }
) {}

export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "start",
    args: () => ({
      chatId: Schema.optionalKey(Id("chats")),
      requestId: NinaRequestId,
      input: NinaInput,
    }),
    returns: () => NinaReceipt,
    error: () =>
      Schema.Union([
        AuthFailure,
        ChatAccessError,
        NinaCreditError,
        NinaPromptError,
        NinaTurnError,
        NinaUploadError,
      ]),
  })
    .middleware(Session)
    .middleware(Atomic)
);
