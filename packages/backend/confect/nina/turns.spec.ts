import { FunctionSpec, GroupSpec } from "@confect/core";
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
  NinaPageSchema,
  NinaRequestId,
  NinaTurnFacts,
  NinaTurnState,
  NinaUserSchema,
  RetiredModelKey,
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

/** Only active generation owns a refundable reservation and verified run context. */
const NinaActiveTurn = Schema.Struct({
  ...NinaTurnFacts.fields,
  ...NinaCreditHold.fields,
  phase: Schema.Literal("active"),
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
const NinaUnansweredTurn = Schema.Struct({
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
      "NINA_WRITE_FAILED",
      "NINA_CONTEXT_FAILED",
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
      modelId: Schema.optionalKey(RetiredModelKey),
      input: NinaInput,
    }),
    returns: () => NinaReceipt,
    error: () =>
      Schema.Union([
        AuthFailure,
        ChatAccessError,
        NinaCreditError,
        NinaTurnError,
        NinaUploadError,
      ]),
  })
    .middleware(Session)
    .middleware(Atomic)
);
