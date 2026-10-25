import {
  Outcome,
  ResponseSpec,
  Selection
} from "./chunk-LRPCFQPE.mjs";
import {
  NinaUsageTotal
} from "./chunk-JTNDCWKY.mjs";
import {
  tryoutRouteKeyValidator
} from "./chunk-Y3FXQOTX.mjs";
import {
  CreditLotDraw
} from "./chunk-W4STF2RW.mjs";
import {
  PromptUserRoleSchema
} from "./chunk-RHHTPJSQ.mjs";
import "./chunk-EAO7HPFQ.mjs";
import {
  appLocaleValidator
} from "./chunk-XBO5OCS5.mjs";
import {
  LocaleSchema
} from "./chunk-BYZ542JT.mjs";
import {
  NINA_FILE_COUNT,
  NinaUploadError
} from "./chunk-KFORYVF7.mjs";
import {
  SessionMiddleware
} from "./chunk-DPQUM2B6.mjs";
import {
  AuthFailure
} from "./chunk-NOBV2WM4.mjs";
import {
  Id
} from "./chunk-ZFJF5VII.mjs";

// ninaTurns.ts
import { Table } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@confect+core@10.3.2+603776d0f6e54403/node_modules/@confect/core/dist/index.js";

// ../nina/turns.spec.ts
import { FunctionSpec, GroupSpec } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@confect+core@10.3.2+603776d0f6e54403/node_modules/@confect/core/dist/index.js";

// ../../client/nina/prompt.ts
import { Schema } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NINA_PROMPT_LENGTH = 1e5;
var NINA_PROMPT_LENGTH_MESSAGE = `The prompt is longer than ${NINA_PROMPT_LENGTH} characters.`;
var isPromptWithinLimit = Schema.is(
  Schema.String.check(Schema.isMaxCodePoints(NINA_PROMPT_LENGTH))
);
var NinaPromptError = class extends Schema.TaggedError()(
  "NinaPromptError",
  {
    code: Schema.Literal("NINA_PROMPT_LENGTH"),
    message: Schema.String
  }
) {
};

// ../../client/nina/receipt.ts
import { Schema as Schema2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaPromptPreview = Schema2.Struct({
  text: Schema2.String,
  files: Schema2.mutable(
    Schema2.Array(
      Schema2.Struct({
        type: Schema2.Literal("file"),
        url: Schema2.String,
        mediaType: Schema2.String,
        filename: Schema2.optional(Schema2.String)
      })
    )
  )
});
var NinaReceipt = Schema2.Struct({
  prompt: NinaPromptPreview,
  chatId: Id("chats"),
  threadId: Schema2.String,
  turnId: Id("ninaTurns"),
  promptMessageId: Schema2.String,
  order: Schema2.Int.check(Schema2.isGreaterThanOrEqualTo(0))
});

// ../chats/access/spec.ts
import { Schema as Schema3 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var ChatAccessError = class extends Schema3.TaggedError()(
  "ChatAccessError",
  {
    code: Schema3.Literals(["CHAT_NOT_FOUND", "FORBIDDEN"]),
    message: Schema3.String
  }
) {
};
var ChatShareReadError = class extends Schema3.TaggedError()(
  "ChatShareReadError",
  {}
) {
};

// ../middleware/atomic.spec.ts
import { MiddlewareSpec } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@confect+core@10.3.2+603776d0f6e54403/node_modules/@confect/core/dist/index.js";
var Atomic = class extends MiddlewareSpec.MiddlewareSpec()(
  "Atomic",
  { functionTypes: { query: false, mutation: true, action: false } }
) {
};

// ../nina/contract/focus.ts
import { Schema as Schema4, Struct } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaFocusInputSchema = Schema4.Struct({
  kind: Schema4.Literal("tryout-question"),
  attemptId: Id("tryoutAttempts"),
  placementId: Id("tryoutAttemptPlacements")
});
var NinaFocusSchema = Schema4.Struct({
  ...NinaFocusInputSchema.fields,
  questionOrder: Schema4.Finite,
  sectionKey: tryoutRouteKeyValidator
}).pipe((schema) => schema.mapFields(Struct.map(Schema4.mutableKey)));
var NinaFocusSourceSchema = Schema4.Struct({
  questionOrder: Schema4.Finite,
  questionLocale: appLocaleValidator,
  questionMdx: Schema4.String,
  explanationMdx: Schema4.String,
  responseSpec: ResponseSpec,
  selection: Schema4.NullOr(Selection),
  outcome: Schema4.NullOr(Outcome)
});

// ../nina/contract/agent.ts
import { LearningProgramKeySchema } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@nakafa+aksara-contracts@1.0.0+23d53938ecc4ddad/node_modules/@nakafa/aksara-contracts/dist/program/spec.js";

// ../nina/contract/source.ts
import { Schema as Schema5, Struct as Struct2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var SourceReferenceSchema = Schema5.Struct({
  href: Schema5.String,
  hostname: Schema5.String,
  text: Schema5.String
}).pipe((schema) => schema.mapFields(Struct2.map(Schema5.mutableKey)));

// ../nina/contract/agent.ts
import { Schema as Schema6, Struct as Struct3 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var AgentCurriculumPreferenceSchema = Schema6.Struct({
  program: Schema6.Struct({
    key: LearningProgramKeySchema,
    title: Schema6.String
  }).pipe((schema) => schema.mapFields(Struct3.map(Schema6.mutableKey)))
}).pipe((schema) => schema.mapFields(Struct3.map(Schema6.mutableKey)));
var AgentContextSchema = Schema6.Struct({
  currentDate: Schema6.String,
  curriculumPreference: Schema6.optional(AgentCurriculumPreferenceSchema),
  memory: Schema6.optional(Schema6.Boolean),
  slug: Schema6.String,
  url: Schema6.String,
  userRole: Schema6.optional(PromptUserRoleSchema),
  verified: Schema6.Boolean
}).pipe((schema) => schema.mapFields(Struct3.map(Schema6.mutableKey)));
var TaskAgentDataSchema = Schema6.Struct({
  userId: Id("users"),
  context: AgentContextSchema,
  locale: LocaleSchema,
  task: Schema6.String
}).pipe((schema) => schema.mapFields(Struct3.map(Schema6.mutableKey)));
var NakafaAgentDataSchema = Schema6.Struct({
  ...TaskAgentDataSchema.fields,
  addresses: Schema6.Array(Schema6.String)
}).pipe((schema) => schema.mapFields(Struct3.map(Schema6.mutableKey)));
var ResearchAgentDataSchema = Schema6.Struct({
  ...TaskAgentDataSchema.fields,
  sourceReferences: Schema6.Array(SourceReferenceSchema),
  toolCallId: Schema6.String,
  words: Schema6.String
}).pipe((schema) => schema.mapFields(Struct3.map(Schema6.mutableKey)));

// ../nina/contract/pack.ts
import { LearningProgramKeySchema as LearningProgramKeySchema2 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/@nakafa+aksara-contracts@1.0.0+23d53938ecc4ddad/node_modules/@nakafa/aksara-contracts/dist/program/spec.js";
import { Effect, Schema as Schema7, Struct as Struct4 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaLearningContextSchema = Schema7.Struct({
  assetId: Schema7.optionalKey(Schema7.String),
  locale: LocaleSchema,
  materialKey: Schema7.optionalKey(Schema7.String),
  section: Schema7.optionalKey(Schema7.String),
  slug: Schema7.String,
  sourcePath: Schema7.optionalKey(Schema7.String),
  title: Schema7.optionalKey(Schema7.String),
  url: Schema7.String,
  verified: Schema7.Boolean
}).pipe((schema) => schema.mapFields(Struct4.map(Schema7.mutableKey)));
var LearningPlacementContextSchema = Schema7.Struct({
  mode: Schema7.Literal("placement"),
  nodeKey: Schema7.String,
  parentHref: Schema7.String,
  parentTitle: Schema7.String,
  programKey: LearningProgramKeySchema2
}).pipe((schema) => schema.mapFields(Struct4.map(Schema7.mutableKey)));
var NinaToolContextSchema = Schema7.Struct({
  allowPageFetch: Schema7.Boolean,
  evidenceScope: Schema7.Literals(["verified-page", "general-learning"])
}).pipe((schema) => schema.mapFields(Struct4.map(Schema7.mutableKey)));
var NinaLearningSessionInputSchema = Schema7.Struct({
  focus: Schema7.optionalKey(NinaFocusSchema),
  learning: NinaLearningContextSchema,
  placement: Schema7.optionalKey(LearningPlacementContextSchema)
}).pipe((schema) => schema.mapFields(Struct4.map(Schema7.mutableKey)));
var NinaContextPackSchema = Schema7.Struct({
  focus: Schema7.optionalKey(NinaFocusSchema),
  learning: NinaLearningContextSchema,
  placement: Schema7.optionalKey(LearningPlacementContextSchema),
  tools: NinaToolContextSchema
}).pipe((schema) => schema.mapFields(Struct4.map(Schema7.mutableKey)));
var NinaLearningSessionSchema = Schema7.Struct({
  context: NinaContextPackSchema
}).pipe((schema) => schema.mapFields(Struct4.map(Schema7.mutableKey)));
var NinaContextError = class extends Schema7.TaggedError()(
  "NinaContextError",
  {
    message: Schema7.String
  }
) {
};
function resolveNinaToolContext(learning) {
  const allowPageFetch = learning.verified;
  return {
    allowPageFetch,
    evidenceScope: allowPageFetch ? "verified-page" : "general-learning"
  };
}
var openNinaLearningSession = Effect.fn(
  "nina.openNinaLearningSession"
)(function* (input) {
  const sessionInput = yield* Schema7.decodeUnknownEffect(
    NinaLearningSessionInputSchema
  )(input).pipe(
    Effect.mapError(
      () => new NinaContextError({
        message: "Invalid Nina learning session input."
      })
    )
  );
  return {
    context: {
      learning: sessionInput.learning,
      ...Struct4.pick(sessionInput, ["focus", "placement"]),
      tools: resolveNinaToolContext(sessionInput.learning)
    }
  };
});

// ../nina/contract/suggestions.ts
import { Schema as Schema8 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaSuggestions = Schema8.mutable(
  Schema8.Array(
    Schema8.Trim.check(Schema8.isMinLength(1), Schema8.isMaxLength(300))
  )
).check(Schema8.isBetweenLength(1, 5));

// ../nina/contract/turn.ts
import { Schema as Schema9, Struct as Struct5 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaPageSchema = Schema9.Struct({
  locale: LocaleSchema,
  needsFetch: Schema9.Boolean,
  nina: NinaContextPackSchema,
  slug: Schema9.String
}).pipe((schema) => schema.mapFields(Struct5.map(Schema9.mutableKey)));
var NinaRuntimeSchema = Schema9.Struct({
  currentDate: Schema9.String
}).pipe((schema) => schema.mapFields(Struct5.map(Schema9.mutableKey)));
var NinaUserSchema = Schema9.Struct({
  curriculumPreference: Schema9.optional(AgentCurriculumPreferenceSchema),
  role: Schema9.optional(PromptUserRoleSchema)
}).pipe((schema) => schema.mapFields(Struct5.map(Schema9.mutableKey)));
var NinaFailureReason = Schema9.Literals([
  "provider-busy",
  "provider-unavailable",
  "service-configuration",
  "request-rejected",
  "input-too-large",
  "response-timeout",
  "content-blocked",
  "response-limit",
  "interrupted",
  "unknown"
]);
var NinaQueuedState = Schema9.Struct({
  status: Schema9.Literal("queued")
});
var NinaRunningState = Schema9.Struct({
  status: Schema9.Literal("running"),
  startedAt: Schema9.Finite
});
var NinaCompleteState = Schema9.Struct({
  status: Schema9.Literal("complete"),
  finishedAt: Schema9.Finite
});
var NinaFailedState = Schema9.Struct({
  status: Schema9.Literal("failed"),
  finishedAt: Schema9.Finite,
  reason: Schema9.optionalKey(NinaFailureReason)
});
var NinaCancelledState = Schema9.Struct({
  status: Schema9.Literal("cancelled"),
  finishedAt: Schema9.Finite
});
var NinaTurnState = Schema9.Union([
  NinaQueuedState,
  NinaRunningState,
  NinaCompleteState,
  NinaFailedState,
  NinaCancelledState
]);
var MillisecondsSinceAdmission = Schema9.Finite.check(
  Schema9.isGreaterThanOrEqualTo(0)
);
var NinaTurnTiming = Schema9.Struct({
  /** A run started and took the turn. This holds the wait for its action to start. */
  claimedMs: Schema9.optionalKey(MillisecondsSinceAdmission),
  /** The run had read what the model needs and was about to call it. */
  readyMs: Schema9.optionalKey(MillisecondsSinceAdmission),
  /**
   * The model produced the first part that the page can show: reasoning, a
   * capability row or answer text. The page shows it a little later, once
   * Agent has written it.
   */
  progressMs: Schema9.optionalKey(MillisecondsSinceAdmission),
  /** The model produced the first word of an answer. */
  tokenMs: Schema9.optionalKey(MillisecondsSinceAdmission)
});
var NinaHistoryCost = Schema9.Struct({
  tokens: Schema9.Int.check(Schema9.isGreaterThanOrEqualTo(0)),
  turns: Schema9.Int.check(Schema9.isGreaterThanOrEqualTo(0)),
  unread: Schema9.optionalKey(
    Schema9.Int.check(Schema9.isGreaterThanOrEqualTo(0))
  )
});
var NinaRequestId = Schema9.NonEmptyString.check(
  Schema9.isMaxLength(128)
);
var NinaTurnFacts = Schema9.Struct({
  userId: Id("users"),
  chatId: Id("chats"),
  threadId: Schema9.String,
  promptMessageId: Schema9.String,
  promptedAt: Schema9.optionalKey(Schema9.Finite),
  order: Schema9.Finite,
  /**
   * The order of the turn that first asked this turn's question, when this turn
   * is a retry. A retry saves its question once more, and a retry of a retry
   * names the same first turn, so every asking of one question carries one key
   * and history shows only the newest complete one.
   */
  retryOf: Schema9.optionalKey(Schema9.Finite),
  credits: Schema9.optionalKey(Schema9.Finite),
  requestId: Schema9.optionalKey(NinaRequestId),
  fingerprint: Schema9.optionalKey(Schema9.String),
  transactionId: Schema9.optionalKey(Id("creditTransactions")),
  page: Schema9.optionalKey(NinaPageSchema),
  user: Schema9.optionalKey(NinaUserSchema),
  tokens: Schema9.optionalKey(
    Schema9.Struct({
      input: Schema9.optionalKey(Schema9.Finite),
      output: Schema9.optionalKey(Schema9.Finite),
      total: Schema9.optionalKey(Schema9.Finite)
    })
  ),
  usage: Schema9.Array(NinaUsageTotal).check(Schema9.isMaxLength(32)),
  /** The waits of the turn. Turns stored before this field have none. */
  timing: Schema9.optionalKey(NinaTurnTiming),
  /** The cost of the history the turn's prompt held. Turns stored before this field have none. */
  history: Schema9.optionalKey(NinaHistoryCost),
  suggestions: Schema9.optionalKey(NinaSuggestions),
  /** Memories Nina saved or confirmed from this turn's message, when there are any. */
  remembered: Schema9.optionalKey(Schema9.Int.check(Schema9.isGreaterThan(0)))
});
var NinaTurnSummary = Schema9.Struct({
  ...NinaTurnFacts.fields,
  state: NinaTurnState
}).mapFields(
  Struct5.pick([
    "order",
    "state",
    "credits",
    "usage",
    "tokens",
    "suggestions",
    "promptMessageId",
    "promptedAt",
    "remembered"
  ])
);

// ../nina/credits/schema.ts
import { Schema as Schema10 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaCreditHold = Schema10.Struct({
  userId: Id("users"),
  credits: Schema10.Finite,
  creditsResetAt: Schema10.Finite,
  planCreditGrantId: Schema10.optionalKey(Id("creditTransactions")),
  transactionId: Id("creditTransactions"),
  lots: Schema10.optionalKey(Schema10.Array(CreditLotDraw))
});
var NinaCreditError = class extends Schema10.TaggedError()(
  "NinaCreditError",
  {
    code: Schema10.Literals([
      "INSUFFICIENT_CREDITS",
      "RATE_LIMITED",
      "NINA_CREDIT_IO_FAILED"
    ]),
    message: Schema10.String
  }
) {
};

// ../nina/turns.spec.ts
import { Schema as Schema11 } from "file:///Users/nabilfatih/Code/nakafa-worktrees/topup/node_modules/.bun/effect@4.0.5/node_modules/effect/dist/index.js";
var NinaPageInput = Schema11.Struct({
  locale: LocaleSchema,
  slug: Schema11.String.pipe(Schema11.check(Schema11.isMaxLength(2048))),
  // Any text: `readMaterialContextHint` leaves out a hint longer than a page
  // writes, which a client built before that bound may still send.
  materialContextHint: Schema11.optionalKey(Schema11.String),
  focus: Schema11.optionalKey(NinaFocusInputSchema)
});
var NinaPrompt = Schema11.Struct({
  text: Schema11.NonEmptyString,
  uploadIds: Schema11.optionalKey(
    Schema11.mutable(
      Schema11.Array(Id("ninaUploads")).check(Schema11.isMaxLength(NINA_FILE_COUNT))
    )
  )
});
var NinaInput = Schema11.Union([
  Schema11.Struct({
    kind: Schema11.Literal("message"),
    prompt: NinaPrompt,
    page: NinaPageInput
  }),
  Schema11.Struct({
    kind: Schema11.Literal("retry"),
    page: Schema11.optionalKey(NinaPageInput),
    order: Schema11.Int.check(Schema11.isGreaterThanOrEqualTo(0))
  })
]);
var NinaActiveTurn = Schema11.Struct({
  ...NinaTurnFacts.fields,
  ...NinaCreditHold.fields,
  phase: Schema11.Literal("active"),
  requestId: NinaRequestId,
  /**
   * A keyed hash of the request, under the learner's key (`nina/fingerprint.ts`).
   * A stored keyed value cannot confirm a guessed message, because the key is not
   * in the database. A fingerprint written before the key was used is an unkeyed
   * hash, so it can still confirm a guessed request, and it never matches a new one
   * (ADR 0024).
   */
  fingerprint: Schema11.String,
  page: NinaPageSchema,
  user: NinaUserSchema,
  state: Schema11.Union([NinaQueuedState, NinaRunningState]),
  cancelRequestedAt: Schema11.optionalKey(Schema11.Finite)
});
var NinaSealHold = Schema11.Literals([
  "accountDeleted",
  "chatDeleted",
  "failedAttempts",
  "promptMissing"
]);
var NinaSettledTurn = Schema11.Struct({
  ...NinaTurnFacts.fields,
  phase: Schema11.Literal("settled"),
  state: Schema11.Union([NinaCompleteState, NinaFailedState, NinaCancelledState]),
  /**
   * When the turn's rows were sealed (ADR 0024). A settled turn without it still
   * holds plain rows, and the sweep seals it, oldest first, within the byte budget
   * of a run (`sealed/drain.ts`). Turns settled before sealing have none.
   */
  sealedAt: Schema11.optionalKey(Schema11.Finite),
  /** How many seals of this turn failed. The sweep holds the turn after `SEAL_TRIES`. */
  sealAttempts: Schema11.optionalKey(
    Schema11.Int.check(Schema11.isGreaterThanOrEqualTo(1))
  ),
  /** When the last seal of this turn failed. */
  sealFailedAt: Schema11.optionalKey(Schema11.Finite),
  /** Why the sweep never takes this turn again (`NinaSealHold`). */
  sealHold: Schema11.optionalKey(NinaSealHold)
});
var NinaTurn = Schema11.Union([NinaActiveTurn, NinaSettledTurn]);
var NinaTurnError = class extends Schema11.TaggedError()(
  "NinaTurnError",
  {
    code: Schema11.Literals([
      "NINA_BUSY",
      "NINA_RETRY_UNAVAILABLE",
      "NINA_REQUEST_CONFLICT",
      "NINA_WRITE_FAILED",
      "NINA_CONTEXT_FAILED",
      "NINA_MESSAGE_SIZE"
    ]),
    message: Schema11.String
  }
) {
};
var turns_spec_default = GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "start",
    args: () => ({
      chatId: Schema11.optionalKey(Id("chats")),
      requestId: NinaRequestId,
      input: NinaInput
    }),
    returns: () => NinaReceipt,
    error: () => Schema11.Union([
      AuthFailure,
      ChatAccessError,
      NinaCreditError,
      NinaPromptError,
      NinaTurnError,
      NinaUploadError
    ])
  }).middleware(SessionMiddleware).middleware(Atomic)
);

// ninaTurns.ts
var ninaTurns_default = Table.make(() => NinaTurn).index("by_userId_and_requestId", ["userId", "requestId"]).index("by_chatId_and_order", ["chatId", "order"]).index("by_chatId_and_phase_and_order", ["chatId", "phase", "order"]).index("by_phase", ["phase"]).index("by_phase_and_sealedAt_and_sealHold", [
  "phase",
  "sealedAt",
  "sealHold"
]).index("by_userId_and_phase", ["userId", "phase"]).index("by_chatId_and_state_status_and_order", [
  "chatId",
  "state.status",
  "order"
]).index("by_chatId_and_retryOf_and_state_status_and_order", [
  "chatId",
  "retryOf",
  "state.status",
  "order"
]);
export {
  ninaTurns_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L3RhYmxlcy9uaW5hVHVybnMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvdHVybnMuc3BlYy50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NsaWVudC9uaW5hL3Byb21wdC50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NsaWVudC9uaW5hL3JlY2VpcHQudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L2NoYXRzL2FjY2Vzcy9zcGVjLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9taWRkbGV3YXJlL2F0b21pYy5zcGVjLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L2ZvY3VzLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L2FnZW50LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L3NvdXJjZS50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9wYWNrLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L3N1Z2dlc3Rpb25zLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L3R1cm4udHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY3JlZGl0cy9zY2hlbWEudHMiXSwKICAic291cmNlUm9vdCI6ICJmaWxlOi8vL3Zhci9mb2xkZXJzL2d6L3JubTR6bl9zNHR6MjZuNG05eWIyMTFiMDAwMDBnbi9UL2NvbmZlY3QtY29udGV4dC1xY05sbEUvb3V0cHV0LyIsCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvdGFibGVzL25pbmFUdXJucy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L3RhYmxlc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L3RhYmxlcy9uaW5hVHVybnMudHNcIjtpbXBvcnQgeyBUYWJsZSB9IGZyb20gXCJAY29uZmVjdC9jb3JlXCI7XG5pbXBvcnQgeyBOaW5hVHVybiB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvbmluYS90dXJucy5zcGVjXCI7XG5cbi8qKlxuICogQSB0dXJuJ3MgYHBoYXNlYCBpcyBcImFjdGl2ZVwiIGV4YWN0bHkgd2hpbGUgaXQgaXMgcXVldWVkIG9yIHJ1bm5pbmcuIFRoZVxuICogYGJ5X3BoYXNlYCByYW5nZSB0aGVyZWZvcmUgZmluZHMgZXZlcnkgb3BlbiB0dXJuIGZvciB0aGUgcmVjb3Zlcnkgc3dlZXAsIGFuZFxuICogYGJ5X3VzZXJJZF9hbmRfcGhhc2VgIGZpbmRzIG9uZSBsZWFybmVyJ3Mgb3BlbiB0dXJucyBhdCBhZG1pc3Npb24sIHRvIHNldHRsZVxuICogdGhlIG9uZXMgdGhleSBzdG9wcGVkIGFuZCB0byBjb3VudCB0aGUgcmVzdC5cbiAqIGBieV9jaGF0SWRfYW5kX3N0YXRlX3N0YXR1c19hbmRfb3JkZXJgIGxpc3RzIHRoZSBuZXdlc3QgY29tcGxldGUgdHVybnMgb2YgYVxuICogY2hhdCB3aXRob3V0IHJlYWRpbmcgdGhlIG9uZXMgdGhhdCBmYWlsZWQgb3Igd2VyZSBzdG9wcGVkLlxuICogYGJ5X2NoYXRJZF9hbmRfcmV0cnlPZl9hbmRfc3RhdGVfc3RhdHVzX2FuZF9vcmRlcmAgZmluZHMgdGhlIG5ld2VzdCBjb21wbGV0ZVxuICogdHVybiB0aGF0IGFza2VkIG9uZSBxdWVzdGlvbiBhZ2FpbiBpbiBvbmUgcmVhZCwgaG93ZXZlciBmYXIgYXBhcnQgdGhlXG4gKiBhc2tpbmdzIGFyZSBhbmQgaG93ZXZlciBtYW55IG9mIHRoZW0gZmFpbGVkIG9yIHdlcmUgc3RvcHBlZC5cbiAqIGBieV9jaGF0SWRfYW5kX3BoYXNlX2FuZF9vcmRlcmAgbGlzdHMgdGhlIHR1cm5zIG9mIGEgY2hhdCB0aGF0IGVuZGVkLCB0aGVcbiAqIG5ld2VzdCBmaXJzdC4gVGhlIHR1cm4gdGhhdCBydW5zIGhhcyBhbm90aGVyIHBoYXNlLCBzbyBpdCBsaWVzIG91dHNpZGUgdGhlXG4gKiByYW5nZSwgYW5kIGEgd3JpdGUgdG8gdGhlIHJ1bm5pbmcgdHVybiAoaXRzIHVzYWdlIGFmdGVyIGV2ZXJ5IG1vZGVsXG4gKiByZXNwb25zZSkgZG9lcyBub3QgcnVuIGEgcXVlcnkgdGhhdCByZWFkcyB0aGUgcmFuZ2UgYWdhaW4uXG4gKiBgYnlfcGhhc2VfYW5kX3NlYWxlZEF0X2FuZF9zZWFsSG9sZGAgZmluZHMgdGhlIHNldHRsZWQgdHVybnMgd2hvc2Ugcm93cyBhcmUgc3RpbGxcbiAqIHBsYWluIGFuZCB0aGF0IHRoZSBzd2VlcCBtYXkgc3RpbGwgc2VhbCwgb2xkZXN0IGZpcnN0IChBRFIgMDAyNCkuIEEgc2VhbGVkIHR1cm5cbiAqIGxlYXZlcyB0aGUgcmFuZ2UsIGFuZCBzbyBkb2VzIGEgdHVybiB0aGUgc3dlZXAgaG9sZHMgZm9yIGdvb2QuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IFRhYmxlLm1ha2UoKCkgPT4gTmluYVR1cm4pXG4gIC5pbmRleChcImJ5X3VzZXJJZF9hbmRfcmVxdWVzdElkXCIsIFtcInVzZXJJZFwiLCBcInJlcXVlc3RJZFwiXSlcbiAgLmluZGV4KFwiYnlfY2hhdElkX2FuZF9vcmRlclwiLCBbXCJjaGF0SWRcIiwgXCJvcmRlclwiXSlcbiAgLmluZGV4KFwiYnlfY2hhdElkX2FuZF9waGFzZV9hbmRfb3JkZXJcIiwgW1wiY2hhdElkXCIsIFwicGhhc2VcIiwgXCJvcmRlclwiXSlcbiAgLmluZGV4KFwiYnlfcGhhc2VcIiwgW1wicGhhc2VcIl0pXG4gIC5pbmRleChcImJ5X3BoYXNlX2FuZF9zZWFsZWRBdF9hbmRfc2VhbEhvbGRcIiwgW1xuICAgIFwicGhhc2VcIixcbiAgICBcInNlYWxlZEF0XCIsXG4gICAgXCJzZWFsSG9sZFwiLFxuICBdKVxuICAuaW5kZXgoXCJieV91c2VySWRfYW5kX3BoYXNlXCIsIFtcInVzZXJJZFwiLCBcInBoYXNlXCJdKVxuICAuaW5kZXgoXCJieV9jaGF0SWRfYW5kX3N0YXRlX3N0YXR1c19hbmRfb3JkZXJcIiwgW1xuICAgIFwiY2hhdElkXCIsXG4gICAgXCJzdGF0ZS5zdGF0dXNcIixcbiAgICBcIm9yZGVyXCIsXG4gIF0pXG4gIC5pbmRleChcImJ5X2NoYXRJZF9hbmRfcmV0cnlPZl9hbmRfc3RhdGVfc3RhdHVzX2FuZF9vcmRlclwiLCBbXG4gICAgXCJjaGF0SWRcIixcbiAgICBcInJldHJ5T2ZcIixcbiAgICBcInN0YXRlLnN0YXR1c1wiLFxuICAgIFwib3JkZXJcIixcbiAgXSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvdHVybnMuc3BlYy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmFcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL3R1cm5zLnNwZWMudHNcIjtpbXBvcnQgeyBGdW5jdGlvblNwZWMsIEdyb3VwU3BlYyB9IGZyb20gXCJAY29uZmVjdC9jb3JlXCI7XG5pbXBvcnQgeyBOaW5hUHJvbXB0RXJyb3IgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jbGllbnQvbmluYS9wcm9tcHRcIjtcbmltcG9ydCB7IE5pbmFSZWNlaXB0IH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY2xpZW50L25pbmEvcmVjZWlwdFwiO1xuaW1wb3J0IHtcbiAgTklOQV9GSUxFX0NPVU5ULFxuICBOaW5hVXBsb2FkRXJyb3IsXG59IGZyb20gXCJAcmVwby9iYWNrZW5kL2NsaWVudC9uaW5hL3VwbG9hZHNcIjtcbmltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQgeyBBdXRoRmFpbHVyZSB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvYXV0aC9zcGVjXCI7XG5pbXBvcnQgeyBDaGF0QWNjZXNzRXJyb3IgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2NoYXRzL2FjY2Vzcy9zcGVjXCI7XG5pbXBvcnQgQXRvbWljIGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvbWlkZGxld2FyZS9hdG9taWMuc3BlY1wiO1xuaW1wb3J0IFNlc3Npb24gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9taWRkbGV3YXJlL3Nlc3Npb24uc3BlY1wiO1xuaW1wb3J0IHsgTmluYUZvY3VzSW5wdXRTY2hlbWEgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvZm9jdXNcIjtcbmltcG9ydCB7XG4gIE5pbmFDYW5jZWxsZWRTdGF0ZSxcbiAgTmluYUNvbXBsZXRlU3RhdGUsXG4gIE5pbmFGYWlsZWRTdGF0ZSxcbiAgTmluYVBhZ2VTY2hlbWEsXG4gIE5pbmFRdWV1ZWRTdGF0ZSxcbiAgTmluYVJlcXVlc3RJZCxcbiAgTmluYVJ1bm5pbmdTdGF0ZSxcbiAgTmluYVR1cm5GYWN0cyxcbiAgTmluYVVzZXJTY2hlbWEsXG59IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC90dXJuXCI7XG5pbXBvcnQge1xuICBOaW5hQ3JlZGl0RXJyb3IsXG4gIE5pbmFDcmVkaXRIb2xkLFxufSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L25pbmEvY3JlZGl0cy9zY2hlbWFcIjtcbmltcG9ydCB7IExvY2FsZVNjaGVtYSB9IGZyb20gXCJAcmVwby9jb250ZW50cy9jb250ZW50XCI7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbmV4cG9ydCBjb25zdCBOaW5hUGFnZUlucHV0ID0gU2NoZW1hLlN0cnVjdCh7XG4gIGxvY2FsZTogTG9jYWxlU2NoZW1hLFxuICBzbHVnOiBTY2hlbWEuU3RyaW5nLnBpcGUoU2NoZW1hLmNoZWNrKFNjaGVtYS5pc01heExlbmd0aCgyMDQ4KSkpLFxuICAvLyBBbnkgdGV4dDogYHJlYWRNYXRlcmlhbENvbnRleHRIaW50YCBsZWF2ZXMgb3V0IGEgaGludCBsb25nZXIgdGhhbiBhIHBhZ2VcbiAgLy8gd3JpdGVzLCB3aGljaCBhIGNsaWVudCBidWlsdCBiZWZvcmUgdGhhdCBib3VuZCBtYXkgc3RpbGwgc2VuZC5cbiAgbWF0ZXJpYWxDb250ZXh0SGludDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5TdHJpbmcpLFxuICBmb2N1czogU2NoZW1hLm9wdGlvbmFsS2V5KE5pbmFGb2N1c0lucHV0U2NoZW1hKSxcbn0pO1xuXG4vKipcbiAqIFRoZSBwcm9tcHQgbGltaXQgaXMgbm90IHBhcnQgb2YgdGhpcyBzY2hlbWEuIEEgdmFsdWUgdGhlIHNjaGVtYSByZWZ1c2VzXG4gKiByZWFjaGVzIHRoZSBsZWFybmVyIGFzIGFuIHVudHlwZWQgc2VydmVyIGZhaWx1cmUsIHNvIGBzdGFydGAgY2hlY2tzIHRoZVxuICogbGVuZ3RoIGl0c2VsZiBhbmQgcmVmdXNlcyB3aXRoIGBOaW5hUHJvbXB0RXJyb3JgLlxuICovXG5leHBvcnQgY29uc3QgTmluYVByb21wdCA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICB0ZXh0OiBTY2hlbWEuTm9uRW1wdHlTdHJpbmcsXG4gIHVwbG9hZElkczogU2NoZW1hLm9wdGlvbmFsS2V5KFxuICAgIFNjaGVtYS5tdXRhYmxlKFxuICAgICAgU2NoZW1hLkFycmF5KElkKFwibmluYVVwbG9hZHNcIikpLmNoZWNrKFNjaGVtYS5pc01heExlbmd0aChOSU5BX0ZJTEVfQ09VTlQpKVxuICAgIClcbiAgKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgTmluYUlucHV0ID0gU2NoZW1hLlVuaW9uKFtcbiAgU2NoZW1hLlN0cnVjdCh7XG4gICAga2luZDogU2NoZW1hLkxpdGVyYWwoXCJtZXNzYWdlXCIpLFxuICAgIHByb21wdDogTmluYVByb21wdCxcbiAgICBwYWdlOiBOaW5hUGFnZUlucHV0LFxuICB9KSxcbiAgU2NoZW1hLlN0cnVjdCh7XG4gICAga2luZDogU2NoZW1hLkxpdGVyYWwoXCJyZXRyeVwiKSxcbiAgICBwYWdlOiBTY2hlbWEub3B0aW9uYWxLZXkoTmluYVBhZ2VJbnB1dCksXG4gICAgb3JkZXI6IFNjaGVtYS5JbnQuY2hlY2soU2NoZW1hLmlzR3JlYXRlclRoYW5PckVxdWFsVG8oMCkpLFxuICB9KSxcbl0pO1xuXG4vKipcbiAqIE9ubHkgYWN0aXZlIGdlbmVyYXRpb24gb3ducyBhIHJlZnVuZGFibGUgcmVzZXJ2YXRpb24gYW5kIHZlcmlmaWVkIHJ1blxuICogY29udGV4dC4gYGNhbmNlbFJlcXVlc3RlZEF0YCBpcyBzZXQgd2hlbiB0aGUgbGVhcm5lciBzdG9wcyBhIHJ1bm5pbmcgdHVybi5cbiAqIFRoZSBwYWdlIHNob3dzIHRoZSB0dXJuIGFzIGNhbmNlbGxlZCBmcm9tIHRoZW4gb24sIGFuZCB0aGUgdHVybiBzZXR0bGVzIHdoZW5cbiAqIGl0cyBydW4gaGFzIGV4aXRlZCwgYWZ0ZXIgdGhlIHN0b3AgZ3JhY2UsIG9yIHdoZW4gdGhlIGxlYXJuZXIgc2VuZHMgdGhlIG5leHRcbiAqIHByb21wdCwgd2hpY2hldmVyIGNvbWVzIGZpcnN0LlxuICovXG5jb25zdCBOaW5hQWN0aXZlVHVybiA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICAuLi5OaW5hVHVybkZhY3RzLmZpZWxkcyxcbiAgLi4uTmluYUNyZWRpdEhvbGQuZmllbGRzLFxuICBwaGFzZTogU2NoZW1hLkxpdGVyYWwoXCJhY3RpdmVcIiksXG4gIHJlcXVlc3RJZDogTmluYVJlcXVlc3RJZCxcbiAgLyoqXG4gICAqIEEga2V5ZWQgaGFzaCBvZiB0aGUgcmVxdWVzdCwgdW5kZXIgdGhlIGxlYXJuZXIncyBrZXkgKGBuaW5hL2ZpbmdlcnByaW50LnRzYCkuXG4gICAqIEEgc3RvcmVkIGtleWVkIHZhbHVlIGNhbm5vdCBjb25maXJtIGEgZ3Vlc3NlZCBtZXNzYWdlLCBiZWNhdXNlIHRoZSBrZXkgaXMgbm90XG4gICAqIGluIHRoZSBkYXRhYmFzZS4gQSBmaW5nZXJwcmludCB3cml0dGVuIGJlZm9yZSB0aGUga2V5IHdhcyB1c2VkIGlzIGFuIHVua2V5ZWRcbiAgICogaGFzaCwgc28gaXQgY2FuIHN0aWxsIGNvbmZpcm0gYSBndWVzc2VkIHJlcXVlc3QsIGFuZCBpdCBuZXZlciBtYXRjaGVzIGEgbmV3IG9uZVxuICAgKiAoQURSIDAwMjQpLlxuICAgKi9cbiAgZmluZ2VycHJpbnQ6IFNjaGVtYS5TdHJpbmcsXG4gIHBhZ2U6IE5pbmFQYWdlU2NoZW1hLFxuICB1c2VyOiBOaW5hVXNlclNjaGVtYSxcbiAgc3RhdGU6IFNjaGVtYS5VbmlvbihbTmluYVF1ZXVlZFN0YXRlLCBOaW5hUnVubmluZ1N0YXRlXSksXG4gIGNhbmNlbFJlcXVlc3RlZEF0OiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkZpbml0ZSksXG59KTtcblxuLyoqXG4gKiBXaHkgdGhlIHN3ZWVwIG5ldmVyIHRha2VzIGEgc2V0dGxlZCB0dXJuIGFnYWluLiBUaGUgc2VhbCBza2lwcGVkIHRoZSB0dXJuIG9uXG4gKiBwdXJwb3NlLCBiZWNhdXNlIGl0cyBjaGF0LCBpdHMgbGVhcm5lciBvciBpdHMgcHJvbXB0IGlzIGdvbmUsIG9yIHRoZSBzZWFsIGZhaWxlZFxuICogYFNFQUxfVFJJRVNgIHRpbWVzLiBTdWNoIGEgdHVybiBrZWVwcyBpdHMgcGxhaW4gcm93cywgd2hpY2ggc3RheSByZWFkYWJsZS5cbiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFTZWFsSG9sZCA9IFNjaGVtYS5MaXRlcmFscyhbXG4gIFwiYWNjb3VudERlbGV0ZWRcIixcbiAgXCJjaGF0RGVsZXRlZFwiLFxuICBcImZhaWxlZEF0dGVtcHRzXCIsXG4gIFwicHJvbXB0TWlzc2luZ1wiLFxuXSk7XG5cbmV4cG9ydCBjb25zdCBOaW5hU2V0dGxlZFR1cm4gPSBTY2hlbWEuU3RydWN0KHtcbiAgLi4uTmluYVR1cm5GYWN0cy5maWVsZHMsXG4gIHBoYXNlOiBTY2hlbWEuTGl0ZXJhbChcInNldHRsZWRcIiksXG4gIHN0YXRlOiBTY2hlbWEuVW5pb24oW05pbmFDb21wbGV0ZVN0YXRlLCBOaW5hRmFpbGVkU3RhdGUsIE5pbmFDYW5jZWxsZWRTdGF0ZV0pLFxuICAvKipcbiAgICogV2hlbiB0aGUgdHVybidzIHJvd3Mgd2VyZSBzZWFsZWQgKEFEUiAwMDI0KS4gQSBzZXR0bGVkIHR1cm4gd2l0aG91dCBpdCBzdGlsbFxuICAgKiBob2xkcyBwbGFpbiByb3dzLCBhbmQgdGhlIHN3ZWVwIHNlYWxzIGl0LCBvbGRlc3QgZmlyc3QsIHdpdGhpbiB0aGUgYnl0ZSBidWRnZXRcbiAgICogb2YgYSBydW4gKGBzZWFsZWQvZHJhaW4udHNgKS4gVHVybnMgc2V0dGxlZCBiZWZvcmUgc2VhbGluZyBoYXZlIG5vbmUuXG4gICAqL1xuICBzZWFsZWRBdDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICAvKiogSG93IG1hbnkgc2VhbHMgb2YgdGhpcyB0dXJuIGZhaWxlZC4gVGhlIHN3ZWVwIGhvbGRzIHRoZSB0dXJuIGFmdGVyIGBTRUFMX1RSSUVTYC4gKi9cbiAgc2VhbEF0dGVtcHRzOiBTY2hlbWEub3B0aW9uYWxLZXkoXG4gICAgU2NoZW1hLkludC5jaGVjayhTY2hlbWEuaXNHcmVhdGVyVGhhbk9yRXF1YWxUbygxKSlcbiAgKSxcbiAgLyoqIFdoZW4gdGhlIGxhc3Qgc2VhbCBvZiB0aGlzIHR1cm4gZmFpbGVkLiAqL1xuICBzZWFsRmFpbGVkQXQ6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuRmluaXRlKSxcbiAgLyoqIFdoeSB0aGUgc3dlZXAgbmV2ZXIgdGFrZXMgdGhpcyB0dXJuIGFnYWluIChgTmluYVNlYWxIb2xkYCkuICovXG4gIHNlYWxIb2xkOiBTY2hlbWEub3B0aW9uYWxLZXkoTmluYVNlYWxIb2xkKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgTmluYVR1cm4gPSBTY2hlbWEuVW5pb24oW05pbmFBY3RpdmVUdXJuLCBOaW5hU2V0dGxlZFR1cm5dKTtcblxuZXhwb3J0IGNsYXNzIE5pbmFUdXJuRXJyb3IgZXh0ZW5kcyBTY2hlbWEuVGFnZ2VkRXJyb3I8TmluYVR1cm5FcnJvcj4oKShcbiAgXCJOaW5hVHVybkVycm9yXCIsXG4gIHtcbiAgICBjb2RlOiBTY2hlbWEuTGl0ZXJhbHMoW1xuICAgICAgXCJOSU5BX0JVU1lcIixcbiAgICAgIFwiTklOQV9SRVRSWV9VTkFWQUlMQUJMRVwiLFxuICAgICAgXCJOSU5BX1JFUVVFU1RfQ09ORkxJQ1RcIixcbiAgICAgIFwiTklOQV9XUklURV9GQUlMRURcIixcbiAgICAgIFwiTklOQV9DT05URVhUX0ZBSUxFRFwiLFxuICAgICAgXCJOSU5BX01FU1NBR0VfU0laRVwiLFxuICAgIF0pLFxuICAgIG1lc3NhZ2U6IFNjaGVtYS5TdHJpbmcsXG4gIH1cbikge31cblxuZXhwb3J0IGRlZmF1bHQgR3JvdXBTcGVjLm1ha2UoKS5hZGRGdW5jdGlvbihcbiAgRnVuY3Rpb25TcGVjLnB1YmxpY011dGF0aW9uKHtcbiAgICBuYW1lOiBcInN0YXJ0XCIsXG4gICAgYXJnczogKCkgPT4gKHtcbiAgICAgIGNoYXRJZDogU2NoZW1hLm9wdGlvbmFsS2V5KElkKFwiY2hhdHNcIikpLFxuICAgICAgcmVxdWVzdElkOiBOaW5hUmVxdWVzdElkLFxuICAgICAgaW5wdXQ6IE5pbmFJbnB1dCxcbiAgICB9KSxcbiAgICByZXR1cm5zOiAoKSA9PiBOaW5hUmVjZWlwdCxcbiAgICBlcnJvcjogKCkgPT5cbiAgICAgIFNjaGVtYS5VbmlvbihbXG4gICAgICAgIEF1dGhGYWlsdXJlLFxuICAgICAgICBDaGF0QWNjZXNzRXJyb3IsXG4gICAgICAgIE5pbmFDcmVkaXRFcnJvcixcbiAgICAgICAgTmluYVByb21wdEVycm9yLFxuICAgICAgICBOaW5hVHVybkVycm9yLFxuICAgICAgICBOaW5hVXBsb2FkRXJyb3IsXG4gICAgICBdKSxcbiAgfSlcbiAgICAubWlkZGxld2FyZShTZXNzaW9uKVxuICAgIC5taWRkbGV3YXJlKEF0b21pYylcbik7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jbGllbnQvbmluYS9wcm9tcHQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY2xpZW50L25pbmFcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY2xpZW50L25pbmEvcHJvbXB0LnRzXCI7aW1wb3J0IHsgU2NoZW1hIH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKipcbiAqIFRoZSBtb3N0IGNoYXJhY3RlcnMgb25lIHByb21wdCBjYW4gaG9sZCwgd2hpY2ggYm91bmRzIHdoYXQgYSBwcm9tcHQgY29zdHMgdG9cbiAqIHNlbmQsIHN0b3JlIGFuZCBjb3VudCBiZWZvcmUgdGhlIHR1cm4gYnVkZ2V0IGlzIHJlYWQuIFRleHQgb2Ygb3JkaW5hcnkgd29yZHNcbiAqIHRoaXMgbG9uZyBpcyBhbHJlYWR5IG92ZXIgdGhlIGJ1ZGdldCBvZiBvbmUgdHVybiAodGhlIGVzdGltYXRvciBjb3VudHNcbiAqIDEwMCwwMDAgTGF0aW4gbGV0dGVycyBhdCBhYm91dCA0NCwwMDAgdG9rZW5zIGFuZCAxMDAsMDAwIEFyYWJpYyBjaGFyYWN0ZXJzIGF0XG4gKiBhYm91dCA4MiwwMDAsIGFnYWluc3QgYSBidWRnZXQgb2YgYWJvdXQgMzMsMDAwKSwgc28gdGhlIGxlYXJuZXIgaXMgdG9sZCB0aGVcbiAqIHNhbWUgdGhpbmcgZm9yIGJvdGggbGltaXRzOiB0aGUgbWVzc2FnZSBpcyB0b28gbG9uZyBmb3Igb25lIHR1cm4sIHdpdGggbm9cbiAqIG51bWJlciB0aGF0IGEgc2hvcnRlciBtZXNzYWdlIGNvdWxkIHN0aWxsIGV4Y2VlZC5cbiAqXG4gKiBBIGNoYXJhY3RlciBoZXJlIGlzIGEgVW5pY29kZSBjb2RlIHBvaW50LCB0aGUgdW5pdCB0aGF0IG1vc3QgbGFuZ3VhZ2VzIGNvdW50XG4gKiBhIHN0cmluZyBpbi4gQSBsZXR0ZXIgb3IgYW4gZW1vamkgb2Ygb25lIGNvZGUgcG9pbnQgY291bnRzIG9uY2UuIEEgc2VxdWVuY2VcbiAqIHN1Y2ggYXMgYSBmYW1pbHkgZW1vamksIG9yIGEgbGV0dGVyIHdpdGggaXRzIGFjY2VudCB3cml0dGVuIGFzIGEgc2VwYXJhdGVcbiAqIG1hcmssIGNvdW50cyBvbmNlIGZvciBlYWNoIGNvZGUgcG9pbnQgaW4gaXQ6IGNvdW50aW5nIHdoYXQgYSByZWFkZXIgc2VlcyBhc1xuICogb25lIGNoYXJhY3RlciB3b3VsZCBsZXQgYSBzaW5nbGUgc2VxdWVuY2UgaG9sZCBhbnkgbnVtYmVyIG9mIGNvZGUgcG9pbnRzLCBzb1xuICogdGhlIGxpbWl0IHdvdWxkIG5vIGxvbmdlciBib3VuZCB3aGF0IHRoZSBwcm9tcHQgY29zdHMgdG8gc3RvcmUgYW5kIHRvIHJlYWQuXG4gKiBUaGUgY29tcG9zZXIgY2hlY2tzIHRoZSBsaW1pdCBiZWZvcmUgaXQgYXNrcyBhbmQgdGhlIGJhY2tlbmQgcmVmdXNlcyBhXG4gKiBsb25nZXIgcHJvbXB0LCBib3RoIHRocm91Z2ggYGlzUHJvbXB0V2l0aGluTGltaXRgLlxuICovXG5leHBvcnQgY29uc3QgTklOQV9QUk9NUFRfTEVOR1RIID0gMTAwXzAwMDtcbi8qKiBTYXlzLCBpbiB0aGUgbG9nLCB0aGF0IG9uZSBwcm9tcHQgaXMgbG9uZ2VyIHRoYW4gdGhlIHByb21wdCBsaW1pdC4gKi9cbmV4cG9ydCBjb25zdCBOSU5BX1BST01QVF9MRU5HVEhfTUVTU0FHRSA9IGBUaGUgcHJvbXB0IGlzIGxvbmdlciB0aGFuICR7TklOQV9QUk9NUFRfTEVOR1RIfSBjaGFyYWN0ZXJzLmA7XG4vKipcbiAqIFdoZXRoZXIgYSBwcm9tcHQgaXMgd2l0aGluIHRoZSBwcm9tcHQgbGltaXQuIEl0IGNvdW50cyBubyBmdXJ0aGVyIHRoYW4gdGhlXG4gKiBsaW1pdCwgc28gYSB2ZXJ5IGxvbmcgcHJvbXB0IGNvc3RzIG5vIG1vcmUgdG8gcmVmdXNlIHRoYW4gb25lIGp1c3Qgb3Zlci5cbiAqL1xuZXhwb3J0IGNvbnN0IGlzUHJvbXB0V2l0aGluTGltaXQgPSBTY2hlbWEuaXMoXG4gIFNjaGVtYS5TdHJpbmcuY2hlY2soU2NoZW1hLmlzTWF4Q29kZVBvaW50cyhOSU5BX1BST01QVF9MRU5HVEgpKVxuKTtcbi8qKiBUaGUgcmVmdXNhbCBvZiBhIHByb21wdCB0aGF0IGlzIGxvbmdlciB0aGFuIHRoZSBwcm9tcHQgbGltaXQuICovXG5leHBvcnQgY2xhc3MgTmluYVByb21wdEVycm9yIGV4dGVuZHMgU2NoZW1hLlRhZ2dlZEVycm9yPE5pbmFQcm9tcHRFcnJvcj4oKShcbiAgXCJOaW5hUHJvbXB0RXJyb3JcIixcbiAge1xuICAgIGNvZGU6IFNjaGVtYS5MaXRlcmFsKFwiTklOQV9QUk9NUFRfTEVOR1RIXCIpLFxuICAgIG1lc3NhZ2U6IFNjaGVtYS5TdHJpbmcsXG4gIH1cbikge31cbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NsaWVudC9uaW5hL3JlY2VpcHQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY2xpZW50L25pbmFcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY2xpZW50L25pbmEvcmVjZWlwdC50c1wiO2ltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKiBDb21taXR0ZWQgcHJvbXB0IHByZXNlbnRhdGlvbiB1c2VkIHdoaWxlIHRoZSBmaXJzdCByZWFjdGl2ZSBwYWdlIGFycml2ZXMuICovXG5jb25zdCBOaW5hUHJvbXB0UHJldmlldyA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICB0ZXh0OiBTY2hlbWEuU3RyaW5nLFxuICBmaWxlczogU2NoZW1hLm11dGFibGUoXG4gICAgU2NoZW1hLkFycmF5KFxuICAgICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICAgIHR5cGU6IFNjaGVtYS5MaXRlcmFsKFwiZmlsZVwiKSxcbiAgICAgICAgdXJsOiBTY2hlbWEuU3RyaW5nLFxuICAgICAgICBtZWRpYVR5cGU6IFNjaGVtYS5TdHJpbmcsXG4gICAgICAgIGZpbGVuYW1lOiBTY2hlbWEub3B0aW9uYWwoU2NoZW1hLlN0cmluZyksXG4gICAgICB9KVxuICAgIClcbiAgKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgTmluYVJlY2VpcHQgPSBTY2hlbWEuU3RydWN0KHtcbiAgcHJvbXB0OiBOaW5hUHJvbXB0UHJldmlldyxcbiAgY2hhdElkOiBJZChcImNoYXRzXCIpLFxuICB0aHJlYWRJZDogU2NoZW1hLlN0cmluZyxcbiAgdHVybklkOiBJZChcIm5pbmFUdXJuc1wiKSxcbiAgcHJvbXB0TWVzc2FnZUlkOiBTY2hlbWEuU3RyaW5nLFxuICBvcmRlcjogU2NoZW1hLkludC5jaGVjayhTY2hlbWEuaXNHcmVhdGVyVGhhbk9yRXF1YWxUbygwKSksXG59KTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvY2hhdHMvYWNjZXNzL3NwZWMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jaGF0cy9hY2Nlc3NcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9jaGF0cy9hY2Nlc3Mvc3BlYy50c1wiO2ltcG9ydCB7IFNjaGVtYSB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIEEgY2hhdCBtdXRhdGlvbiByZXF1aXJlcyBhbiBleGlzdGluZyBjaGF0IG93bmVkIGJ5IHRoZSBjdXJyZW50IGFjY291bnQuICovXG5leHBvcnQgY2xhc3MgQ2hhdEFjY2Vzc0Vycm9yIGV4dGVuZHMgU2NoZW1hLlRhZ2dlZEVycm9yPENoYXRBY2Nlc3NFcnJvcj4oKShcbiAgXCJDaGF0QWNjZXNzRXJyb3JcIixcbiAge1xuICAgIGNvZGU6IFNjaGVtYS5MaXRlcmFscyhbXCJDSEFUX05PVF9GT1VORFwiLCBcIkZPUkJJRERFTlwiXSksXG4gICAgbWVzc2FnZTogU2NoZW1hLlN0cmluZyxcbiAgfVxuKSB7fVxuXG4vKiogVGhlIHNoYXJlIG9mIGEgY2hhdCBjb3VsZCBub3QgYmUgcmVhZCBvciBvcGVuZWQsIHNvIGl0cyBsaW5rIGNhbm5vdCBiZSBzaG93bi4gKi9cbmV4cG9ydCBjbGFzcyBDaGF0U2hhcmVSZWFkRXJyb3IgZXh0ZW5kcyBTY2hlbWEuVGFnZ2VkRXJyb3I8Q2hhdFNoYXJlUmVhZEVycm9yPigpKFxuICBcIkNoYXRTaGFyZVJlYWRFcnJvclwiLFxuICB7fVxuKSB7fVxuIiwgImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9taWRkbGV3YXJlL2F0b21pYy5zcGVjLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbWlkZGxld2FyZVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L21pZGRsZXdhcmUvYXRvbWljLnNwZWMudHNcIjtpbXBvcnQgeyBNaWRkbGV3YXJlU3BlYyB9IGZyb20gXCJAY29uZmVjdC9jb3JlXCI7XG5cbi8qKiBSdW5zIHRhYmxlIGludmFyaWFudHMgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYXMgZWFjaCBhcHBsaWNhdGlvbiBtdXRhdGlvbi4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21pYyBleHRlbmRzIE1pZGRsZXdhcmVTcGVjLk1pZGRsZXdhcmVTcGVjPEF0b21pYz4oKShcbiAgXCJBdG9taWNcIixcbiAgeyBmdW5jdGlvblR5cGVzOiB7IHF1ZXJ5OiBmYWxzZSwgbXV0YXRpb246IHRydWUsIGFjdGlvbjogZmFsc2UgfSB9XG4pIHt9XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvZm9jdXMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9mb2N1cy50c1wiO2ltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQgeyBhcHBMb2NhbGVWYWxpZGF0b3IgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2NvbnRlbnRSZWxlYXNlL3NwZWNcIjtcbmltcG9ydCB7XG4gIE91dGNvbWUsXG4gIFJlc3BvbnNlU3BlYyxcbiAgU2VsZWN0aW9uLFxufSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3Jlc3BvbnNlL21vZGVsXCI7XG5pbXBvcnQgeyB0cnlvdXRSb3V0ZUtleVZhbGlkYXRvciB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvdHJ5b3V0cy9yb3V0ZVwiO1xuaW1wb3J0IHsgU2NoZW1hLCBTdHJ1Y3QgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKiBPbmUgdHJ5LW91dCBxdWVzdGlvbiB0aGUgbGVhcm5lciBhc2tlZCBOaW5hIGFib3V0IGZyb20gYSBmaW5pc2hlZCByZXZpZXcuICovXG5leHBvcnQgY29uc3QgTmluYUZvY3VzSW5wdXRTY2hlbWEgPSBTY2hlbWEuU3RydWN0KHtcbiAga2luZDogU2NoZW1hLkxpdGVyYWwoXCJ0cnlvdXQtcXVlc3Rpb25cIiksXG4gIGF0dGVtcHRJZDogSWQoXCJ0cnlvdXRBdHRlbXB0c1wiKSxcbiAgcGxhY2VtZW50SWQ6IElkKFwidHJ5b3V0QXR0ZW1wdFBsYWNlbWVudHNcIiksXG59KTtcblxuLyoqIFRoZSB2ZXJpZmllZCBxdWVzdGlvbiBmb2N1cyBmcm96ZW4gaW50byBhIHR1cm4ncyBjb250ZXh0IHBhY2suICovXG5leHBvcnQgY29uc3QgTmluYUZvY3VzU2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIC4uLk5pbmFGb2N1c0lucHV0U2NoZW1hLmZpZWxkcyxcbiAgcXVlc3Rpb25PcmRlcjogU2NoZW1hLkZpbml0ZSxcbiAgc2VjdGlvbktleTogdHJ5b3V0Um91dGVLZXlWYWxpZGF0b3IsXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcblxuLyoqIFNpZ25lZCBxdWVzdGlvbiBmYWN0cyByZWFkIGZvciBvbmUgZ2VuZXJhdGlvbiBhZnRlciBlbnRpdGxlbWVudCBpcyByZWNoZWNrZWQuICovXG5leHBvcnQgY29uc3QgTmluYUZvY3VzU291cmNlU2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIHF1ZXN0aW9uT3JkZXI6IFNjaGVtYS5GaW5pdGUsXG4gIHF1ZXN0aW9uTG9jYWxlOiBhcHBMb2NhbGVWYWxpZGF0b3IsXG4gIHF1ZXN0aW9uTWR4OiBTY2hlbWEuU3RyaW5nLFxuICBleHBsYW5hdGlvbk1keDogU2NoZW1hLlN0cmluZyxcbiAgcmVzcG9uc2VTcGVjOiBSZXNwb25zZVNwZWMsXG4gIHNlbGVjdGlvbjogU2NoZW1hLk51bGxPcihTZWxlY3Rpb24pLFxuICBvdXRjb21lOiBTY2hlbWEuTnVsbE9yKE91dGNvbWUpLFxufSk7XG5cbmV4cG9ydCB0eXBlIE5pbmFGb2N1c0lucHV0ID0gdHlwZW9mIE5pbmFGb2N1c0lucHV0U2NoZW1hLlR5cGU7XG5leHBvcnQgdHlwZSBOaW5hRm9jdXMgPSB0eXBlb2YgTmluYUZvY3VzU2NoZW1hLlR5cGU7XG5leHBvcnQgdHlwZSBOaW5hRm9jdXNTb3VyY2UgPSB0eXBlb2YgTmluYUZvY3VzU291cmNlU2NoZW1hLlR5cGU7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvYWdlbnQudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9hZ2VudC50c1wiO2ltcG9ydCB7IExlYXJuaW5nUHJvZ3JhbUtleVNjaGVtYSB9IGZyb20gXCJAbmFrYWZhL2Frc2FyYS1jb250cmFjdHMvcHJvZ3JhbS9zcGVjXCI7XG5pbXBvcnQgeyBJZCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvX2dlbmVyYXRlZC9pZFwiO1xuaW1wb3J0IHsgU291cmNlUmVmZXJlbmNlU2NoZW1hIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L3NvdXJjZVwiO1xuaW1wb3J0IHsgUHJvbXB0VXNlclJvbGVTY2hlbWEgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3VzZXJzL3JvbGVcIjtcbmltcG9ydCB7IExvY2FsZVNjaGVtYSB9IGZyb20gXCJAcmVwby9jb250ZW50cy9jb250ZW50XCI7XG5pbXBvcnQgeyBTY2hlbWEsIFN0cnVjdCB9IGZyb20gXCJlZmZlY3RcIjtcbi8qKiBDYW5vbmljYWwgY3VycmljdWx1bSBwcmVmZXJlbmNlIGF2YWlsYWJsZSB0byBhZ2VudHMuICovXG5leHBvcnQgY29uc3QgQWdlbnRDdXJyaWN1bHVtUHJlZmVyZW5jZVNjaGVtYSA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICBwcm9ncmFtOiBTY2hlbWEuU3RydWN0KHtcbiAgICBrZXk6IExlYXJuaW5nUHJvZ3JhbUtleVNjaGVtYSxcbiAgICB0aXRsZTogU2NoZW1hLlN0cmluZyxcbiAgfSkucGlwZSgoc2NoZW1hKSA9PiBzY2hlbWEubWFwRmllbGRzKFN0cnVjdC5tYXAoU2NoZW1hLm11dGFibGVLZXkpKSksXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcbmV4cG9ydCB0eXBlIEFnZW50Q3VycmljdWx1bVByZWZlcmVuY2UgPVxuICB0eXBlb2YgQWdlbnRDdXJyaWN1bHVtUHJlZmVyZW5jZVNjaGVtYS5UeXBlO1xuLyoqXG4gKiBQZXItdHVybiBjb250ZXh0IHNoYXJlZCBieSBOaW5hIGFuZCBzcGVjaWFsaXN0IGFnZW50cyBhZnRlciBhdXRoZW50aWNhdGVkXG4gKiBhZG1pc3Npb24uIGBtZW1vcnlgIGlzIHdoZXRoZXIgdGhlIGxlYXJuZXIncyBtZW1vcnkgaXMgb24gZm9yIHRoZSB0dXJuLCB3aGljaFxuICogb25seSBOaW5hJ3Mgb3duIHR1cm4ga25vd3M6IGEgY29udGV4dCB3aXRob3V0IGl0IGhhcyBubyBtZW1vcnkgY2FwYWJpbGl0eS5cbiAqL1xuY29uc3QgQWdlbnRDb250ZXh0U2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIGN1cnJlbnREYXRlOiBTY2hlbWEuU3RyaW5nLFxuICBjdXJyaWN1bHVtUHJlZmVyZW5jZTogU2NoZW1hLm9wdGlvbmFsKEFnZW50Q3VycmljdWx1bVByZWZlcmVuY2VTY2hlbWEpLFxuICBtZW1vcnk6IFNjaGVtYS5vcHRpb25hbChTY2hlbWEuQm9vbGVhbiksXG4gIHNsdWc6IFNjaGVtYS5TdHJpbmcsXG4gIHVybDogU2NoZW1hLlN0cmluZyxcbiAgdXNlclJvbGU6IFNjaGVtYS5vcHRpb25hbChQcm9tcHRVc2VyUm9sZVNjaGVtYSksXG4gIHZlcmlmaWVkOiBTY2hlbWEuQm9vbGVhbixcbn0pLnBpcGUoKHNjaGVtYSkgPT4gc2NoZW1hLm1hcEZpZWxkcyhTdHJ1Y3QubWFwKFNjaGVtYS5tdXRhYmxlS2V5KSkpO1xuZXhwb3J0IHR5cGUgQWdlbnRDb250ZXh0ID0gdHlwZW9mIEFnZW50Q29udGV4dFNjaGVtYS5UeXBlO1xuLyoqIFNjaGVtYS1kZXJpdmVkIGRhdGEgcGFzc2VkIHRvIHRhc2stb3JpZW50ZWQgc3BlY2lhbGlzdCBhZ2VudHMuICovXG5jb25zdCBUYXNrQWdlbnREYXRhU2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIHVzZXJJZDogSWQoXCJ1c2Vyc1wiKSxcbiAgY29udGV4dDogQWdlbnRDb250ZXh0U2NoZW1hLFxuICBsb2NhbGU6IExvY2FsZVNjaGVtYSxcbiAgdGFzazogU2NoZW1hLlN0cmluZyxcbn0pLnBpcGUoKHNjaGVtYSkgPT4gc2NoZW1hLm1hcEZpZWxkcyhTdHJ1Y3QubWFwKFNjaGVtYS5tdXRhYmxlS2V5KSkpO1xuZXhwb3J0IHR5cGUgVGFza0FnZW50RGF0YSA9IHR5cGVvZiBUYXNrQWdlbnREYXRhU2NoZW1hLlR5cGU7XG4vKipcbiAqIFNjaGVtYS1kZXJpdmVkIGRhdGEgcGFzc2VkIHRvIHRoZSBOYWthZmEgY29udGVudCBzcGVjaWFsaXN0LiBgYWRkcmVzc2VzYCBhcmVcbiAqIHRoZSBsaW5rcyB0byBOYWthZmEncyBvd24gc2l0ZSB0aGF0IHRoZSBsZWFybmVyIHNlbnQsIHdoaWNoIGl0IG11c3QgcmVhZC5cbiAqL1xuY29uc3QgTmFrYWZhQWdlbnREYXRhU2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIC4uLlRhc2tBZ2VudERhdGFTY2hlbWEuZmllbGRzLFxuICBhZGRyZXNzZXM6IFNjaGVtYS5BcnJheShTY2hlbWEuU3RyaW5nKSxcbn0pLnBpcGUoKHNjaGVtYSkgPT4gc2NoZW1hLm1hcEZpZWxkcyhTdHJ1Y3QubWFwKFNjaGVtYS5tdXRhYmxlS2V5KSkpO1xuZXhwb3J0IHR5cGUgTmFrYWZhQWdlbnREYXRhID0gdHlwZW9mIE5ha2FmYUFnZW50RGF0YVNjaGVtYS5UeXBlO1xuLyoqXG4gKiBTY2hlbWEtZGVyaXZlZCBkYXRhIHBhc3NlZCB0byB0aGUgZXh0ZXJuYWwgcmVzZWFyY2ggc3BlY2lhbGlzdC4gYHRhc2tgIGlzXG4gKiB0aGUgTWFya2Rvd24gdGhlIHJlc2VhcmNoIG1vZGVsIHJlYWRzLiBgd29yZHNgIGFyZSB0aGUgdG9vbCBjYWxsJ3Mgb3duIHdvcmRzXG4gKiB3aXRoIG5vIGhlYWRpbmcsIHdoaWNoIGNob29zZSB0aGUgcGFyYWdyYXBocyBvZiBhIHBhZ2UgdGhhdCBhcmUgcmVhZC5cbiAqL1xuY29uc3QgUmVzZWFyY2hBZ2VudERhdGFTY2hlbWEgPSBTY2hlbWEuU3RydWN0KHtcbiAgLi4uVGFza0FnZW50RGF0YVNjaGVtYS5maWVsZHMsXG4gIHNvdXJjZVJlZmVyZW5jZXM6IFNjaGVtYS5BcnJheShTb3VyY2VSZWZlcmVuY2VTY2hlbWEpLFxuICB0b29sQ2FsbElkOiBTY2hlbWEuU3RyaW5nLFxuICB3b3JkczogU2NoZW1hLlN0cmluZyxcbn0pLnBpcGUoKHNjaGVtYSkgPT4gc2NoZW1hLm1hcEZpZWxkcyhTdHJ1Y3QubWFwKFNjaGVtYS5tdXRhYmxlS2V5KSkpO1xuZXhwb3J0IHR5cGUgUmVzZWFyY2hBZ2VudERhdGEgPSB0eXBlb2YgUmVzZWFyY2hBZ2VudERhdGFTY2hlbWEuVHlwZTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9zb3VyY2UudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9zb3VyY2UudHNcIjtpbXBvcnQgeyBTY2hlbWEsIFN0cnVjdCB9IGZyb20gXCJlZmZlY3RcIjtcblxuLyoqIFJ1bnRpbWUgY29udHJhY3QgZm9yIG9uZSBleHRlcm5hbCBzb3VyY2UgcmVmZXJlbmNlIGV4dHJhY3RlZCBmcm9tIHVzZXIgdGV4dC4gKi9cbmV4cG9ydCBjb25zdCBTb3VyY2VSZWZlcmVuY2VTY2hlbWEgPSBTY2hlbWEuU3RydWN0KHtcbiAgaHJlZjogU2NoZW1hLlN0cmluZyxcbiAgaG9zdG5hbWU6IFNjaGVtYS5TdHJpbmcsXG4gIHRleHQ6IFNjaGVtYS5TdHJpbmcsXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9wYWNrLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdFwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvcGFjay50c1wiO2ltcG9ydCB7IExlYXJuaW5nUHJvZ3JhbUtleVNjaGVtYSB9IGZyb20gXCJAbmFrYWZhL2Frc2FyYS1jb250cmFjdHMvcHJvZ3JhbS9zcGVjXCI7XG5pbXBvcnQgeyBOaW5hRm9jdXNTY2hlbWEgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvZm9jdXNcIjtcbmltcG9ydCB7IExvY2FsZVNjaGVtYSB9IGZyb20gXCJAcmVwby9jb250ZW50cy9jb250ZW50XCI7XG5pbXBvcnQgeyBFZmZlY3QsIFNjaGVtYSwgU3RydWN0IH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKiogUGFnZSBpZGVudGl0eSBOaW5hIGNhbiB0cnVzdCBiZWNhdXNlIHRoZSBhcHAgdmFsaWRhdGVkIGl0IGJlZm9yZSB0aGUgdHVybi4gKi9cbmNvbnN0IE5pbmFMZWFybmluZ0NvbnRleHRTY2hlbWEgPSBTY2hlbWEuU3RydWN0KHtcbiAgYXNzZXRJZDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5TdHJpbmcpLFxuICBsb2NhbGU6IExvY2FsZVNjaGVtYSxcbiAgbWF0ZXJpYWxLZXk6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuU3RyaW5nKSxcbiAgc2VjdGlvbjogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5TdHJpbmcpLFxuICBzbHVnOiBTY2hlbWEuU3RyaW5nLFxuICBzb3VyY2VQYXRoOiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLlN0cmluZyksXG4gIHRpdGxlOiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLlN0cmluZyksXG4gIHVybDogU2NoZW1hLlN0cmluZyxcbiAgdmVyaWZpZWQ6IFNjaGVtYS5Cb29sZWFuLFxufSkucGlwZSgoc2NoZW1hKSA9PiBzY2hlbWEubWFwRmllbGRzKFN0cnVjdC5tYXAoU2NoZW1hLm11dGFibGVLZXkpKSk7XG4vKiogVmVyaWZpZWQgcGxhY2VtZW50IHRoYXQgZXhwbGFpbnMgd2h5IHRoaXMgYXNzZXQgd2FzIG9wZW5lZCBmcm9tIG5hdmlnYXRpb24uICovXG5jb25zdCBMZWFybmluZ1BsYWNlbWVudENvbnRleHRTY2hlbWEgPSBTY2hlbWEuU3RydWN0KHtcbiAgbW9kZTogU2NoZW1hLkxpdGVyYWwoXCJwbGFjZW1lbnRcIiksXG4gIG5vZGVLZXk6IFNjaGVtYS5TdHJpbmcsXG4gIHBhcmVudEhyZWY6IFNjaGVtYS5TdHJpbmcsXG4gIHBhcmVudFRpdGxlOiBTY2hlbWEuU3RyaW5nLFxuICBwcm9ncmFtS2V5OiBMZWFybmluZ1Byb2dyYW1LZXlTY2hlbWEsXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcbi8qKlxuICogV2hhdCB0aGUgbW9kZWwgaXMgdG9sZCBhYm91dCB0aGUgZXZpZGVuY2Ugb2YgYSB0dXJuOiB3aGV0aGVyIHRoZSBzaWduZWRcbiAqIGNvbnRlbnQgb2YgdGhlIHBhZ2UgaXMgZ2l2ZW4gdG8gaXQsIGFuZCB0aGUgc2NvcGUgdGhhdCBldmlkZW5jZSBoYXMuIEJvdGhcbiAqIGZvbGxvdyBmcm9tIHdoZXRoZXIgdGhlIHBhZ2UgaXMgdmVyaWZpZWQuXG4gKi9cbmNvbnN0IE5pbmFUb29sQ29udGV4dFNjaGVtYSA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICBhbGxvd1BhZ2VGZXRjaDogU2NoZW1hLkJvb2xlYW4sXG4gIGV2aWRlbmNlU2NvcGU6IFNjaGVtYS5MaXRlcmFscyhbXCJ2ZXJpZmllZC1wYWdlXCIsIFwiZ2VuZXJhbC1sZWFybmluZ1wiXSksXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcbi8qKiBWYWxpZGF0ZWQgbGVhcm5pbmcgY29udGV4dCBvZiB0aGUgcGFnZSBhIGxlYXJuZXIgaXMgb24gYmVmb3JlIG9uZSBOaW5hIHR1cm4uICovXG5jb25zdCBOaW5hTGVhcm5pbmdTZXNzaW9uSW5wdXRTY2hlbWEgPSBTY2hlbWEuU3RydWN0KHtcbiAgZm9jdXM6IFNjaGVtYS5vcHRpb25hbEtleShOaW5hRm9jdXNTY2hlbWEpLFxuICBsZWFybmluZzogTmluYUxlYXJuaW5nQ29udGV4dFNjaGVtYSxcbiAgcGxhY2VtZW50OiBTY2hlbWEub3B0aW9uYWxLZXkoTGVhcm5pbmdQbGFjZW1lbnRDb250ZXh0U2NoZW1hKSxcbn0pLnBpcGUoKHNjaGVtYSkgPT4gc2NoZW1hLm1hcEZpZWxkcyhTdHJ1Y3QubWFwKFNjaGVtYS5tdXRhYmxlS2V5KSkpO1xudHlwZSBOaW5hTGVhcm5pbmdDb250ZXh0ID0gdHlwZW9mIE5pbmFMZWFybmluZ0NvbnRleHRTY2hlbWEuVHlwZTtcbnR5cGUgTmluYVRvb2xDb250ZXh0ID0gdHlwZW9mIE5pbmFUb29sQ29udGV4dFNjaGVtYS5UeXBlO1xuLyoqIFdoYXQgYSB0dXJuIGtub3dzIGFib3V0IGl0cyBwYWdlOiBzdG9yZWQgd2l0aCB0aGUgdHVybiBhbmQgcHJpbnRlZCBpbiBpdHMgcHJvbXB0LiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFDb250ZXh0UGFja1NjaGVtYSA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICBmb2N1czogU2NoZW1hLm9wdGlvbmFsS2V5KE5pbmFGb2N1c1NjaGVtYSksXG4gIGxlYXJuaW5nOiBOaW5hTGVhcm5pbmdDb250ZXh0U2NoZW1hLFxuICBwbGFjZW1lbnQ6IFNjaGVtYS5vcHRpb25hbEtleShMZWFybmluZ1BsYWNlbWVudENvbnRleHRTY2hlbWEpLFxuICB0b29sczogTmluYVRvb2xDb250ZXh0U2NoZW1hLFxufSkucGlwZSgoc2NoZW1hKSA9PiBzY2hlbWEubWFwRmllbGRzKFN0cnVjdC5tYXAoU2NoZW1hLm11dGFibGVLZXkpKSk7XG5leHBvcnQgdHlwZSBOaW5hQ29udGV4dFBhY2sgPSB0eXBlb2YgTmluYUNvbnRleHRQYWNrU2NoZW1hLlR5cGU7XG4vKiogTGVhcm5pbmcgY29udGV4dCBwZXJzaXN0ZWQgd2l0aCBvbmUgTmluYSB0dXJuLiAqL1xuY29uc3QgTmluYUxlYXJuaW5nU2Vzc2lvblNjaGVtYSA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICBjb250ZXh0OiBOaW5hQ29udGV4dFBhY2tTY2hlbWEsXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcbnR5cGUgTmluYUxlYXJuaW5nU2Vzc2lvbiA9IHR5cGVvZiBOaW5hTGVhcm5pbmdTZXNzaW9uU2NoZW1hLlR5cGU7XG4vKiogUmFpc2VkIHdoZW4gdGhlIGFwcCBib3VuZGFyeSBzZW5kcyBhbiBpbnZhbGlkIE5pbmEgbGVhcm5pbmcgY29udGV4dC4gKi9cbmNsYXNzIE5pbmFDb250ZXh0RXJyb3IgZXh0ZW5kcyBTY2hlbWEuVGFnZ2VkRXJyb3I8TmluYUNvbnRleHRFcnJvcj4oKShcbiAgXCJOaW5hQ29udGV4dEVycm9yXCIsXG4gIHtcbiAgICBtZXNzYWdlOiBTY2hlbWEuU3RyaW5nLFxuICB9XG4pIHt9XG4vKiogUmVzb2x2ZXMgdGhlIGV2aWRlbmNlIHRoZSBtb2RlbCBpcyB0b2xkIGFib3V0IGZyb20gdmFsaWRhdGVkIGNvbnRleHQuICovXG5mdW5jdGlvbiByZXNvbHZlTmluYVRvb2xDb250ZXh0KFxuICBsZWFybmluZzogTmluYUxlYXJuaW5nQ29udGV4dFxuKTogTmluYVRvb2xDb250ZXh0IHtcbiAgY29uc3QgYWxsb3dQYWdlRmV0Y2ggPSBsZWFybmluZy52ZXJpZmllZDtcbiAgcmV0dXJuIHtcbiAgICBhbGxvd1BhZ2VGZXRjaCxcbiAgICBldmlkZW5jZVNjb3BlOiBhbGxvd1BhZ2VGZXRjaCA/IFwidmVyaWZpZWQtcGFnZVwiIDogXCJnZW5lcmFsLWxlYXJuaW5nXCIsXG4gIH07XG59XG4vKiogT3BlbnMgb25lIHZhbGlkYXRlZCBOaW5hIGxlYXJuaW5nIHNlc3Npb24gYXMgYW4gRWZmZWN0LW5hdGl2ZSBwcm9ncmFtLiAqL1xuZXhwb3J0IGNvbnN0IG9wZW5OaW5hTGVhcm5pbmdTZXNzaW9uID0gRWZmZWN0LmZuKFxuICBcIm5pbmEub3Blbk5pbmFMZWFybmluZ1Nlc3Npb25cIlxuKShmdW5jdGlvbiogKGlucHV0OiB1bmtub3duKSB7XG4gIGNvbnN0IHNlc3Npb25JbnB1dCA9IHlpZWxkKiBTY2hlbWEuZGVjb2RlVW5rbm93bkVmZmVjdChcbiAgICBOaW5hTGVhcm5pbmdTZXNzaW9uSW5wdXRTY2hlbWFcbiAgKShpbnB1dCkucGlwZShcbiAgICBFZmZlY3QubWFwRXJyb3IoXG4gICAgICAoKSA9PlxuICAgICAgICBuZXcgTmluYUNvbnRleHRFcnJvcih7XG4gICAgICAgICAgbWVzc2FnZTogXCJJbnZhbGlkIE5pbmEgbGVhcm5pbmcgc2Vzc2lvbiBpbnB1dC5cIixcbiAgICAgICAgfSlcbiAgICApXG4gICk7XG4gIHJldHVybiB7XG4gICAgY29udGV4dDoge1xuICAgICAgbGVhcm5pbmc6IHNlc3Npb25JbnB1dC5sZWFybmluZyxcbiAgICAgIC4uLlN0cnVjdC5waWNrKHNlc3Npb25JbnB1dCwgW1wiZm9jdXNcIiwgXCJwbGFjZW1lbnRcIl0pLFxuICAgICAgdG9vbHM6IHJlc29sdmVOaW5hVG9vbENvbnRleHQoc2Vzc2lvbklucHV0LmxlYXJuaW5nKSxcbiAgICB9LFxuICB9IHNhdGlzZmllcyBOaW5hTGVhcm5pbmdTZXNzaW9uO1xufSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3Qvc3VnZ2VzdGlvbnMudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0XCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC9zdWdnZXN0aW9ucy50c1wiO2ltcG9ydCB7IFNjaGVtYSB9IGZyb20gXCJlZmZlY3RcIjtcblxuZXhwb3J0IGNvbnN0IE5pbmFTdWdnZXN0aW9ucyA9IFNjaGVtYS5tdXRhYmxlKFxuICBTY2hlbWEuQXJyYXkoXG4gICAgU2NoZW1hLlRyaW0uY2hlY2soU2NoZW1hLmlzTWluTGVuZ3RoKDEpLCBTY2hlbWEuaXNNYXhMZW5ndGgoMzAwKSlcbiAgKVxuKS5jaGVjayhTY2hlbWEuaXNCZXR3ZWVuTGVuZ3RoKDEsIDUpKTtcbiIsICJjb25zdCBfX2luamVjdGVkX2ZpbGVuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC90dXJuLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9uYWJpbGZhdGloL0NvZGUvbmFrYWZhLXdvcmt0cmVlcy90b3B1cC9wYWNrYWdlcy9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdFwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvdHVybi50c1wiO2ltcG9ydCB7IElkIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9fZ2VuZXJhdGVkL2lkXCI7XG5pbXBvcnQge1xuICB0eXBlIEFnZW50Q29udGV4dCxcbiAgQWdlbnRDdXJyaWN1bHVtUHJlZmVyZW5jZVNjaGVtYSxcbn0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L2FnZW50XCI7XG5pbXBvcnQgeyBOaW5hQ29udGV4dFBhY2tTY2hlbWEgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L25pbmEvY29udHJhY3QvcGFja1wiO1xuaW1wb3J0IHsgTmluYVN1Z2dlc3Rpb25zIH0gZnJvbSBcIkByZXBvL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NvbnRyYWN0L3N1Z2dlc3Rpb25zXCI7XG5pbXBvcnQgeyBOaW5hVXNhZ2VUb3RhbCB9IGZyb20gXCJAcmVwby9iYWNrZW5kL2NvbmZlY3QvbmluYS9jb250cmFjdC91c2FnZVwiO1xuaW1wb3J0IHsgUHJvbXB0VXNlclJvbGVTY2hlbWEgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L3VzZXJzL3JvbGVcIjtcbmltcG9ydCB7IExvY2FsZVNjaGVtYSB9IGZyb20gXCJAcmVwby9jb250ZW50cy9jb250ZW50XCI7XG5pbXBvcnQgeyBjbGVhblNsdWcgfSBmcm9tIFwiQHJlcG8vdXRpbGl0aWVzL3NsdWdcIjtcbmltcG9ydCB7IFNjaGVtYSwgU3RydWN0IH0gZnJvbSBcImVmZmVjdFwiO1xuXG4vKipcbiAqIFZlcmlmaWVkIGxlYXJuaW5nIHBhZ2Ugc3RhdGUgY29uc3VtZWQgYnkgb25lIE5pbmEgdHVybi4gSXRzIGFkZHJlc3MgYW5kIHNpZ25lZFxuICogc3RhdGUgYXJlIGBuaW5hLmxlYXJuaW5nLnVybGAgYW5kIGBuaW5hLmxlYXJuaW5nLnZlcmlmaWVkYCwgYW5kIG5vd2hlcmUgZWxzZS5cbiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFQYWdlU2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIGxvY2FsZTogTG9jYWxlU2NoZW1hLFxuICBuZWVkc0ZldGNoOiBTY2hlbWEuQm9vbGVhbixcbiAgbmluYTogTmluYUNvbnRleHRQYWNrU2NoZW1hLFxuICBzbHVnOiBTY2hlbWEuU3RyaW5nLFxufSkucGlwZSgoc2NoZW1hKSA9PiBzY2hlbWEubWFwRmllbGRzKFN0cnVjdC5tYXAoU2NoZW1hLm11dGFibGVLZXkpKSk7XG4vKiogUnVudGltZSBmYWN0cyB0aGF0IGFyZSBzdGFibGUgZm9yIG9uZSBOaW5hIHR1cm4uICovXG5jb25zdCBOaW5hUnVudGltZVNjaGVtYSA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICBjdXJyZW50RGF0ZTogU2NoZW1hLlN0cmluZyxcbn0pLnBpcGUoKHNjaGVtYSkgPT4gc2NoZW1hLm1hcEZpZWxkcyhTdHJ1Y3QubWFwKFNjaGVtYS5tdXRhYmxlS2V5KSkpO1xuLyoqIFVzZXIgZmFjdHMgTmluYSBtYXkgdXNlIGFmdGVyIGFwcCBhdXRoIGFuZCBzZWxlY3Rpb24gYm91bmRhcmllcyB2YWxpZGF0ZSB0aGVtLiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFVc2VyU2NoZW1hID0gU2NoZW1hLlN0cnVjdCh7XG4gIGN1cnJpY3VsdW1QcmVmZXJlbmNlOiBTY2hlbWEub3B0aW9uYWwoQWdlbnRDdXJyaWN1bHVtUHJlZmVyZW5jZVNjaGVtYSksXG4gIHJvbGU6IFNjaGVtYS5vcHRpb25hbChQcm9tcHRVc2VyUm9sZVNjaGVtYSksXG59KS5waXBlKChzY2hlbWEpID0+IHNjaGVtYS5tYXBGaWVsZHMoU3RydWN0Lm1hcChTY2hlbWEubXV0YWJsZUtleSkpKTtcbi8qKiBTYWZlIHJlc3BvbnNlIGZhaWx1cmUgZmFjdHMsIGluZGVwZW5kZW50IG9mIHByb3ZpZGVyIGRpYWdub3N0aWNzIGFuZCBVSSBsYW5ndWFnZS4gKi9cbmV4cG9ydCBjb25zdCBOaW5hRmFpbHVyZVJlYXNvbiA9IFNjaGVtYS5MaXRlcmFscyhbXG4gIFwicHJvdmlkZXItYnVzeVwiLFxuICBcInByb3ZpZGVyLXVuYXZhaWxhYmxlXCIsXG4gIFwic2VydmljZS1jb25maWd1cmF0aW9uXCIsXG4gIFwicmVxdWVzdC1yZWplY3RlZFwiLFxuICBcImlucHV0LXRvby1sYXJnZVwiLFxuICBcInJlc3BvbnNlLXRpbWVvdXRcIixcbiAgXCJjb250ZW50LWJsb2NrZWRcIixcbiAgXCJyZXNwb25zZS1saW1pdFwiLFxuICBcImludGVycnVwdGVkXCIsXG4gIFwidW5rbm93blwiLFxuXSk7XG4vKiogQSB0dXJuIHRoYXQgd2FzIGFkbWl0dGVkIGFuZCB3YWl0cyBmb3IgYSBydW4uICovXG5leHBvcnQgY29uc3QgTmluYVF1ZXVlZFN0YXRlID0gU2NoZW1hLlN0cnVjdCh7XG4gIHN0YXR1czogU2NoZW1hLkxpdGVyYWwoXCJxdWV1ZWRcIiksXG59KTtcbi8qKiBBIHR1cm4gdGhhdCBhIHJ1biB0b29rLiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFSdW5uaW5nU3RhdGUgPSBTY2hlbWEuU3RydWN0KHtcbiAgc3RhdHVzOiBTY2hlbWEuTGl0ZXJhbChcInJ1bm5pbmdcIiksXG4gIHN0YXJ0ZWRBdDogU2NoZW1hLkZpbml0ZSxcbn0pO1xuLyoqIEEgdHVybiB0aGF0IGVuZGVkIHdpdGggYW4gYW5zd2VyLiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFDb21wbGV0ZVN0YXRlID0gU2NoZW1hLlN0cnVjdCh7XG4gIHN0YXR1czogU2NoZW1hLkxpdGVyYWwoXCJjb21wbGV0ZVwiKSxcbiAgZmluaXNoZWRBdDogU2NoZW1hLkZpbml0ZSxcbn0pO1xuLyoqIEEgdHVybiB0aGF0IGVuZGVkIHdpdGhvdXQgb25lLCB3aXRoIHRoZSByZWFzb24gd2hlbiBpdCBpcyBrbm93bi4gKi9cbmV4cG9ydCBjb25zdCBOaW5hRmFpbGVkU3RhdGUgPSBTY2hlbWEuU3RydWN0KHtcbiAgc3RhdHVzOiBTY2hlbWEuTGl0ZXJhbChcImZhaWxlZFwiKSxcbiAgZmluaXNoZWRBdDogU2NoZW1hLkZpbml0ZSxcbiAgcmVhc29uOiBTY2hlbWEub3B0aW9uYWxLZXkoTmluYUZhaWx1cmVSZWFzb24pLFxufSk7XG4vKiogQSB0dXJuIHRoYXQgdGhlIGxlYXJuZXIgc3RvcHBlZC4gKi9cbmV4cG9ydCBjb25zdCBOaW5hQ2FuY2VsbGVkU3RhdGUgPSBTY2hlbWEuU3RydWN0KHtcbiAgc3RhdHVzOiBTY2hlbWEuTGl0ZXJhbChcImNhbmNlbGxlZFwiKSxcbiAgZmluaXNoZWRBdDogU2NoZW1hLkZpbml0ZSxcbn0pO1xuLyoqXG4gKiBFdmVyeSBzdGF0ZSBhIHR1cm4gY2FuIGJlIGluLiBUaGUgb3JkZXIgb2YgdGhlIG1lbWJlcnMgaXMgdGhlIG9yZGVyIHRoZVxuICogc3RvcmVkIHZhbGlkYXRvciBsaXN0cyB0aGVtIGluLiBBIHBoYXNlIHBpY2tzIGl0cyBzdGF0ZXMgYnkgdGhlc2UgbmFtZXMsIHNvIGFcbiAqIG5ldyBzdGF0ZSBjYW5ub3Qgc2xpcCBpbnRvIG9uZSBieSBpdHMgcG9zaXRpb24uIFRoZSB3ZWIgYXBwIHJlYWRzIHRoZSB0eXBlIG9mXG4gKiBpdHMgYHN0YXR1c2AuXG4gKi9cbmV4cG9ydCBjb25zdCBOaW5hVHVyblN0YXRlID0gU2NoZW1hLlVuaW9uKFtcbiAgTmluYVF1ZXVlZFN0YXRlLFxuICBOaW5hUnVubmluZ1N0YXRlLFxuICBOaW5hQ29tcGxldGVTdGF0ZSxcbiAgTmluYUZhaWxlZFN0YXRlLFxuICBOaW5hQ2FuY2VsbGVkU3RhdGUsXG5dKTtcbi8qKlxuICogTWlsbGlzZWNvbmRzIGNvdW50ZWQgZnJvbSB0aGUgYWRtaXNzaW9uIG9mIGEgdHVybiwgbmV2ZXIgYmVsb3cgemVyby4gQVxuICogY3JlYXRpb24gdGltZSBjYXJyaWVzIGEgZnJhY3Rpb24gb2YgYSBtaWxsaXNlY29uZCwgYW5kIHNvIGRvZXMgdGhlIGNvdW50LlxuICovXG5jb25zdCBNaWxsaXNlY29uZHNTaW5jZUFkbWlzc2lvbiA9IFNjaGVtYS5GaW5pdGUuY2hlY2soXG4gIFNjaGVtYS5pc0dyZWF0ZXJUaGFuT3JFcXVhbFRvKDApXG4pO1xuXG4vKipcbiAqIEhvdyBsb25nIGEgbGVhcm5lciB3YWl0ZWQgYXQgZWFjaCBzdGFnZSBvZiBhIHR1cm4sIGluIG1pbGxpc2Vjb25kcyBhZnRlciBpdHNcbiAqIGFkbWlzc2lvbi4gRWFjaCBzdGFnZSBpcyBzdG9yZWQgdGhlIGZpcnN0IHRpbWUgdGhlIHR1cm4gcmVhY2hlcyBpdCwgc28gYSB0dXJuXG4gKiB0aGF0IGVuZGVkIGVhcmx5IGhvbGRzIG9ubHkgdGhlIHN0YWdlcyBpdCByZWFjaGVkLCBhbmQgdGhlIGdhcCBiZXR3ZWVuIHR3b1xuICogc3RhZ2VzIGlzIHRoZSB3YWl0IGJldHdlZW4gdGhlbS4gSXQgaG9sZHMgbnVtYmVycyBvbmx5LCBuZXZlciBhIHdvcmQgb2YgdGhlXG4gKiBjb252ZXJzYXRpb24uXG4gKi9cbmV4cG9ydCBjb25zdCBOaW5hVHVyblRpbWluZyA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICAvKiogQSBydW4gc3RhcnRlZCBhbmQgdG9vayB0aGUgdHVybi4gVGhpcyBob2xkcyB0aGUgd2FpdCBmb3IgaXRzIGFjdGlvbiB0byBzdGFydC4gKi9cbiAgY2xhaW1lZE1zOiBTY2hlbWEub3B0aW9uYWxLZXkoTWlsbGlzZWNvbmRzU2luY2VBZG1pc3Npb24pLFxuICAvKiogVGhlIHJ1biBoYWQgcmVhZCB3aGF0IHRoZSBtb2RlbCBuZWVkcyBhbmQgd2FzIGFib3V0IHRvIGNhbGwgaXQuICovXG4gIHJlYWR5TXM6IFNjaGVtYS5vcHRpb25hbEtleShNaWxsaXNlY29uZHNTaW5jZUFkbWlzc2lvbiksXG4gIC8qKlxuICAgKiBUaGUgbW9kZWwgcHJvZHVjZWQgdGhlIGZpcnN0IHBhcnQgdGhhdCB0aGUgcGFnZSBjYW4gc2hvdzogcmVhc29uaW5nLCBhXG4gICAqIGNhcGFiaWxpdHkgcm93IG9yIGFuc3dlciB0ZXh0LiBUaGUgcGFnZSBzaG93cyBpdCBhIGxpdHRsZSBsYXRlciwgb25jZVxuICAgKiBBZ2VudCBoYXMgd3JpdHRlbiBpdC5cbiAgICovXG4gIHByb2dyZXNzTXM6IFNjaGVtYS5vcHRpb25hbEtleShNaWxsaXNlY29uZHNTaW5jZUFkbWlzc2lvbiksXG4gIC8qKiBUaGUgbW9kZWwgcHJvZHVjZWQgdGhlIGZpcnN0IHdvcmQgb2YgYW4gYW5zd2VyLiAqL1xuICB0b2tlbk1zOiBTY2hlbWEub3B0aW9uYWxLZXkoTWlsbGlzZWNvbmRzU2luY2VBZG1pc3Npb24pLFxufSk7XG5cbi8qKlxuICogV2hhdCB0aGUgaGlzdG9yeSBjb3N0IHdoZW4gdGhlIHByb21wdCBvZiBhIHR1cm4gd2FzIGJ1aWx0OiB0aGUgdG9rZW5zIG9mIHRoZVxuICogY29tcGxldGUgdHVybnMgdGhhdCBjYW1lIGJlZm9yZSBpdCBhbmQgdGhhdCB0aGUgc3VtbWFyeSBkaWQgbm90IGNvdmVyLCBob3dcbiAqIG1hbnkgdGhleSB3ZXJlLCBhbmQgdGhlIGhpZ2hlc3Qgb3JkZXIgdGhlIHJlYWQgbGVmdCBvdXQgKGB1bnJlYWRgKSB3aGVuIGl0XG4gKiBzdG9wcGVkIGJlZm9yZSB0aGUgb2xkZXN0IG9mIHRoZW0uIFRoZSBzdW1tYXJ5J3MgZm9sZCBjb3VudHMgdGhlc2UgdHVybnMgdG9cbiAqIHRlbGwgd2hldGhlciBpdCBpcyBkdWUsIGFuZCBhIHR1cm4gdGhhdCBzdG9yZXMgdGhlIGNvc3QgbGV0cyB0aGUgZm9sZCBjb3VudFxuICogb25seSB0aGUgdHVybiB0aGF0IGp1c3Qgc2V0dGxlZC4gQSB0dXJuIHRoYXQgbmV2ZXIgYnVpbHQgYSBwcm9tcHQsIG9yIHdob3NlXG4gKiBydW4gZGlkIG5vdCBlbmQgd2VsbCwgc3RvcmVzIG5vbmUuXG4gKi9cbmV4cG9ydCBjb25zdCBOaW5hSGlzdG9yeUNvc3QgPSBTY2hlbWEuU3RydWN0KHtcbiAgdG9rZW5zOiBTY2hlbWEuSW50LmNoZWNrKFNjaGVtYS5pc0dyZWF0ZXJUaGFuT3JFcXVhbFRvKDApKSxcbiAgdHVybnM6IFNjaGVtYS5JbnQuY2hlY2soU2NoZW1hLmlzR3JlYXRlclRoYW5PckVxdWFsVG8oMCkpLFxuICB1bnJlYWQ6IFNjaGVtYS5vcHRpb25hbEtleShcbiAgICBTY2hlbWEuSW50LmNoZWNrKFNjaGVtYS5pc0dyZWF0ZXJUaGFuT3JFcXVhbFRvKDApKVxuICApLFxufSk7XG5cbi8qKiBBIHJlcXVlc3Qga2V5IHN1cnZpdmVzIHNldHRsZW1lbnQgc28gbmV0d29yayByZXRyaWVzIHJlbWFpbiBpZGVtcG90ZW50LiAqL1xuZXhwb3J0IGNvbnN0IE5pbmFSZXF1ZXN0SWQgPSBTY2hlbWEuTm9uRW1wdHlTdHJpbmcuY2hlY2soXG4gIFNjaGVtYS5pc01heExlbmd0aCgxMjgpXG4pO1xuLyoqIFJlY29yZGVkIHJlc3BvbnNlIGZhY3RzIG5ldmVyIGludmVudCBhbiB1bmtub3duIG1vZGVsLCBjaGFyZ2Ugb3IgdG9rZW4gY291bnQuICovXG5leHBvcnQgY29uc3QgTmluYVR1cm5GYWN0cyA9IFNjaGVtYS5TdHJ1Y3Qoe1xuICB1c2VySWQ6IElkKFwidXNlcnNcIiksXG4gIGNoYXRJZDogSWQoXCJjaGF0c1wiKSxcbiAgdGhyZWFkSWQ6IFNjaGVtYS5TdHJpbmcsXG4gIHByb21wdE1lc3NhZ2VJZDogU2NoZW1hLlN0cmluZyxcbiAgcHJvbXB0ZWRBdDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICBvcmRlcjogU2NoZW1hLkZpbml0ZSxcbiAgLyoqXG4gICAqIFRoZSBvcmRlciBvZiB0aGUgdHVybiB0aGF0IGZpcnN0IGFza2VkIHRoaXMgdHVybidzIHF1ZXN0aW9uLCB3aGVuIHRoaXMgdHVyblxuICAgKiBpcyBhIHJldHJ5LiBBIHJldHJ5IHNhdmVzIGl0cyBxdWVzdGlvbiBvbmNlIG1vcmUsIGFuZCBhIHJldHJ5IG9mIGEgcmV0cnlcbiAgICogbmFtZXMgdGhlIHNhbWUgZmlyc3QgdHVybiwgc28gZXZlcnkgYXNraW5nIG9mIG9uZSBxdWVzdGlvbiBjYXJyaWVzIG9uZSBrZXlcbiAgICogYW5kIGhpc3Rvcnkgc2hvd3Mgb25seSB0aGUgbmV3ZXN0IGNvbXBsZXRlIG9uZS5cbiAgICovXG4gIHJldHJ5T2Y6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuRmluaXRlKSxcbiAgY3JlZGl0czogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICByZXF1ZXN0SWQ6IFNjaGVtYS5vcHRpb25hbEtleShOaW5hUmVxdWVzdElkKSxcbiAgZmluZ2VycHJpbnQ6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuU3RyaW5nKSxcbiAgdHJhbnNhY3Rpb25JZDogU2NoZW1hLm9wdGlvbmFsS2V5KElkKFwiY3JlZGl0VHJhbnNhY3Rpb25zXCIpKSxcbiAgcGFnZTogU2NoZW1hLm9wdGlvbmFsS2V5KE5pbmFQYWdlU2NoZW1hKSxcbiAgdXNlcjogU2NoZW1hLm9wdGlvbmFsS2V5KE5pbmFVc2VyU2NoZW1hKSxcbiAgdG9rZW5zOiBTY2hlbWEub3B0aW9uYWxLZXkoXG4gICAgU2NoZW1hLlN0cnVjdCh7XG4gICAgICBpbnB1dDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICAgICAgb3V0cHV0OiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkZpbml0ZSksXG4gICAgICB0b3RhbDogU2NoZW1hLm9wdGlvbmFsS2V5KFNjaGVtYS5GaW5pdGUpLFxuICAgIH0pXG4gICksXG4gIHVzYWdlOiBTY2hlbWEuQXJyYXkoTmluYVVzYWdlVG90YWwpLmNoZWNrKFNjaGVtYS5pc01heExlbmd0aCgzMikpLFxuICAvKiogVGhlIHdhaXRzIG9mIHRoZSB0dXJuLiBUdXJucyBzdG9yZWQgYmVmb3JlIHRoaXMgZmllbGQgaGF2ZSBub25lLiAqL1xuICB0aW1pbmc6IFNjaGVtYS5vcHRpb25hbEtleShOaW5hVHVyblRpbWluZyksXG4gIC8qKiBUaGUgY29zdCBvZiB0aGUgaGlzdG9yeSB0aGUgdHVybidzIHByb21wdCBoZWxkLiBUdXJucyBzdG9yZWQgYmVmb3JlIHRoaXMgZmllbGQgaGF2ZSBub25lLiAqL1xuICBoaXN0b3J5OiBTY2hlbWEub3B0aW9uYWxLZXkoTmluYUhpc3RvcnlDb3N0KSxcbiAgc3VnZ2VzdGlvbnM6IFNjaGVtYS5vcHRpb25hbEtleShOaW5hU3VnZ2VzdGlvbnMpLFxuICAvKiogTWVtb3JpZXMgTmluYSBzYXZlZCBvciBjb25maXJtZWQgZnJvbSB0aGlzIHR1cm4ncyBtZXNzYWdlLCB3aGVuIHRoZXJlIGFyZSBhbnkuICovXG4gIHJlbWVtYmVyZWQ6IFNjaGVtYS5vcHRpb25hbEtleShTY2hlbWEuSW50LmNoZWNrKFNjaGVtYS5pc0dyZWF0ZXJUaGFuKDApKSksXG59KTtcbi8qKiBQdWJsaWMgcmVzcG9uc2UgZmFjdHMgZXhjbHVkZSBhY2NvdW50LCBiaWxsaW5nLXBlcmlvZCBhbmQgcHJpdmF0ZSBwYWdlIGNvbnRleHQuICovXG5leHBvcnQgY29uc3QgTmluYVR1cm5TdW1tYXJ5ID0gU2NoZW1hLlN0cnVjdCh7XG4gIC4uLk5pbmFUdXJuRmFjdHMuZmllbGRzLFxuICBzdGF0ZTogTmluYVR1cm5TdGF0ZSxcbn0pLm1hcEZpZWxkcyhcbiAgU3RydWN0LnBpY2soW1xuICAgIFwib3JkZXJcIixcbiAgICBcInN0YXRlXCIsXG4gICAgXCJjcmVkaXRzXCIsXG4gICAgXCJ1c2FnZVwiLFxuICAgIFwidG9rZW5zXCIsXG4gICAgXCJzdWdnZXN0aW9uc1wiLFxuICAgIFwicHJvbXB0TWVzc2FnZUlkXCIsXG4gICAgXCJwcm9tcHRlZEF0XCIsXG4gICAgXCJyZW1lbWJlcmVkXCIsXG4gIF0pXG4pO1xuLyoqXG4gKiBUaGUgdHVybiBhcyBhIHJlYWRlciB3aG8gZG9lcyBub3Qgb3duIHRoZSBjaGF0IGlzIHRvbGQgb2YgaXQ6IHdoZXJlIGl0IHN0YW5kc1xuICogYW5kIHdoaWNoIHByb21wdCBpdCBhbnN3ZXJzLiBXaGF0IHRoZSB0dXJuIGNvc3QsIHdoYXQgTmluYSBrZXB0IGZyb20gaXQgYW5kXG4gKiB3aGF0IHNoZSBzdWdnZXN0cyBuZXh0IGJlbG9uZyB0byB0aGUgb3duZXIncyBhY2NvdW50LCBzbyBhIHJlYWRlciBpcyB0b2xkXG4gKiBub25lIG9mIHRoZW0uIGB1c2FnZWAgc3RheXMgaW4gdGhlIHNoYXBlIGFzIGFuIGVtcHR5IGxpc3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkZXJUdXJuKFxuICB0dXJuOiB0eXBlb2YgTmluYVR1cm5TdW1tYXJ5LlR5cGVcbik6IHR5cGVvZiBOaW5hVHVyblN1bW1hcnkuVHlwZSB7XG4gIHJldHVybiB7XG4gICAgLi4uU3RydWN0LnBpY2sodHVybiwgW1wib3JkZXJcIiwgXCJwcm9tcHRNZXNzYWdlSWRcIiwgXCJwcm9tcHRlZEF0XCIsIFwic3RhdGVcIl0pLFxuICAgIHVzYWdlOiBbXSxcbiAgfTtcbn1cbmV4cG9ydCB0eXBlIE5pbmFQYWdlID0gdHlwZW9mIE5pbmFQYWdlU2NoZW1hLlR5cGU7XG5leHBvcnQgdHlwZSBOaW5hUnVudGltZSA9IHR5cGVvZiBOaW5hUnVudGltZVNjaGVtYS5UeXBlO1xuZXhwb3J0IHR5cGUgTmluYVVzZXIgPSB0eXBlb2YgTmluYVVzZXJTY2hlbWEuVHlwZTtcbi8qKiBSZXR1cm5zIHRoZSBpbW11dGFibGUgbGVhcm5pbmcgcGFnZSB0aGF0IHNob3VsZCBkcml2ZSBvbmUgTmluYSB0dXJuLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWROaW5hTGVhcm5pbmdQYWdlKHBhZ2U6IE5pbmFQYWdlKSB7XG4gIGNvbnN0IGxlYXJuaW5nID0gcGFnZS5uaW5hLmxlYXJuaW5nO1xuICByZXR1cm4ge1xuICAgIGxvY2FsZTogbGVhcm5pbmcubG9jYWxlLFxuICAgIHNsdWc6IGNsZWFuU2x1ZyhsZWFybmluZy5zbHVnKSxcbiAgICB1cmw6IGxlYXJuaW5nLnVybCxcbiAgICB2ZXJpZmllZDogbGVhcm5pbmcudmVyaWZpZWQsXG4gIH07XG59XG4vKipcbiAqIEJ1aWxkcyB0aGUgc2hhcmVkIHNwZWNpYWxpc3QgY29udGV4dCBmcm9tIHZhbGlkYXRlZCBOaW5hIHR1cm4gaW5wdXRzLlxuICogYG1lbW9yeWAgaXMgd2hldGhlciB0aGUgbGVhcm5lcidzIG1lbW9yeSBpcyBvbiBmb3IgdGhlIHR1cm4uIFRoZSB0dXJuIHJlYWRzXG4gKiB0aGUgcGF1c2Ugb25jZSwgYW5kIHRoZSBjYXBhYmlsaXR5IHBvbGljeSBkZWNpZGVzIGZyb20gaXQgd2hldGhlciB0aGUgbWVtb3J5XG4gKiBjYXBhYmlsaXR5IGlzIG9mZmVyZWQgYW5kIHdoZXRoZXIgYSBjYWxsIG1heSBydW4uIEV2ZXJ5IG90aGVyIGNhcGFiaWxpdHkgaXNcbiAqIG9mZmVyZWQgb24gZXZlcnkgcGFnZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU5pbmFBZ2VudENvbnRleHQoe1xuICBtZW1vcnksXG4gIHBhZ2UsXG4gIHJ1bnRpbWUsXG4gIHVzZXIsXG59OiB7XG4gIHJlYWRvbmx5IG1lbW9yeTogYm9vbGVhbjtcbiAgcmVhZG9ubHkgcGFnZTogTmluYVBhZ2U7XG4gIHJlYWRvbmx5IHJ1bnRpbWU6IE5pbmFSdW50aW1lO1xuICByZWFkb25seSB1c2VyOiBOaW5hVXNlcjtcbn0pOiBBZ2VudENvbnRleHQge1xuICBjb25zdCBsZWFybmluZ1BhZ2UgPSByZWFkTmluYUxlYXJuaW5nUGFnZShwYWdlKTtcbiAgcmV0dXJuIHtcbiAgICBjdXJyZW50RGF0ZTogcnVudGltZS5jdXJyZW50RGF0ZSxcbiAgICBtZW1vcnksXG4gICAgc2x1ZzogbGVhcm5pbmdQYWdlLnNsdWcsXG4gICAgdXJsOiBsZWFybmluZ1BhZ2UudXJsLFxuICAgIHZlcmlmaWVkOiBsZWFybmluZ1BhZ2UudmVyaWZpZWQsXG4gICAgLi4uKHVzZXIuY3VycmljdWx1bVByZWZlcmVuY2VcbiAgICAgID8geyBjdXJyaWN1bHVtUHJlZmVyZW5jZTogdXNlci5jdXJyaWN1bHVtUHJlZmVyZW5jZSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlID8geyB1c2VyUm9sZTogdXNlci5yb2xlIH0gOiB7fSksXG4gIH07XG59XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvbmFiaWxmYXRpaC9Db2RlL25ha2FmYS13b3JrdHJlZXMvdG9wdXAvcGFja2FnZXMvYmFja2VuZC9jb25mZWN0L25pbmEvY3JlZGl0cy9zY2hlbWEudHNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NyZWRpdHNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL25hYmlsZmF0aWgvQ29kZS9uYWthZmEtd29ya3RyZWVzL3RvcHVwL3BhY2thZ2VzL2JhY2tlbmQvY29uZmVjdC9uaW5hL2NyZWRpdHMvc2NoZW1hLnRzXCI7aW1wb3J0IHsgSWQgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L19nZW5lcmF0ZWQvaWRcIjtcbmltcG9ydCB7IENyZWRpdExvdERyYXcgfSBmcm9tIFwiQHJlcG8vYmFja2VuZC9jb25mZWN0L2NyZWRpdHMvc2NoZW1hXCI7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tIFwiZWZmZWN0XCI7XG5cbi8qKlxuICogVGhlIGFjdGl2ZSBBZ2VudCB0dXJuIG93bnMgaXRzIHJlZnVuZGFibGUgY3JlZGl0IHJlc2VydmF0aW9uLiBgbG90c2AgbmFtZXMgdGhlXG4gKiB0b3AtdXAgcGFja3MgdGhlIHJlc2VydmF0aW9uIGRyZXcgZnJvbSwgaW4gdGhlIG9yZGVyIGl0IGRyZXcgdGhlbS4gVGhlIHJlc3Qgb2ZcbiAqIGBjcmVkaXRzYCBjYW1lIGZyb20gdGhlIGFsbG93YW5jZS4gQSB0dXJuIHJlc2VydmVkIGJlZm9yZSBwYWNrcyBleGlzdGVkIGhhc1xuICogbm9uZSwgc28gdGhlIHdob2xlIHJlc2VydmF0aW9uIGNhbWUgZnJvbSB0aGUgYWxsb3dhbmNlLlxuICovXG5leHBvcnQgY29uc3QgTmluYUNyZWRpdEhvbGQgPSBTY2hlbWEuU3RydWN0KHtcbiAgdXNlcklkOiBJZChcInVzZXJzXCIpLFxuICBjcmVkaXRzOiBTY2hlbWEuRmluaXRlLFxuICBjcmVkaXRzUmVzZXRBdDogU2NoZW1hLkZpbml0ZSxcbiAgcGxhbkNyZWRpdEdyYW50SWQ6IFNjaGVtYS5vcHRpb25hbEtleShJZChcImNyZWRpdFRyYW5zYWN0aW9uc1wiKSksXG4gIHRyYW5zYWN0aW9uSWQ6IElkKFwiY3JlZGl0VHJhbnNhY3Rpb25zXCIpLFxuICBsb3RzOiBTY2hlbWEub3B0aW9uYWxLZXkoU2NoZW1hLkFycmF5KENyZWRpdExvdERyYXcpKSxcbn0pO1xuXG5leHBvcnQgY2xhc3MgTmluYUNyZWRpdEVycm9yIGV4dGVuZHMgU2NoZW1hLlRhZ2dlZEVycm9yPE5pbmFDcmVkaXRFcnJvcj4oKShcbiAgXCJOaW5hQ3JlZGl0RXJyb3JcIixcbiAge1xuICAgIGNvZGU6IFNjaGVtYS5MaXRlcmFscyhbXG4gICAgICBcIklOU1VGRklDSUVOVF9DUkVESVRTXCIsXG4gICAgICBcIlJBVEVfTElNSVRFRFwiLFxuICAgICAgXCJOSU5BX0NSRURJVF9JT19GQUlMRURcIixcbiAgICBdKSxcbiAgICBtZXNzYWdlOiBTY2hlbWEuU3RyaW5nLFxuICB9XG4pIHt9XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBaVgsU0FBUyxhQUFhOzs7QUNBMUIsU0FBUyxjQUFjLGlCQUFpQjs7O0FDQW5ELFNBQVMsY0FBYztBQW9CbFgsSUFBTSxxQkFBcUI7QUFFM0IsSUFBTSw2QkFBNkIsNkJBQTZCLGtCQUFrQjtBQUtsRixJQUFNLHNCQUFzQixPQUFPO0FBQUEsRUFDeEMsT0FBTyxPQUFPLE1BQU0sT0FBTyxnQkFBZ0Isa0JBQWtCLENBQUM7QUFDaEU7QUFFTyxJQUFNLGtCQUFOLGNBQThCLE9BQU8sWUFBNkI7QUFBQSxFQUN2RTtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU0sT0FBTyxRQUFRLG9CQUFvQjtBQUFBLElBQ3pDLFNBQVMsT0FBTztBQUFBLEVBQ2xCO0FBQ0YsRUFBRTtBQUFDOzs7QUNwQ0gsU0FBUyxVQUFBQSxlQUFjO0FBR3ZCLElBQU0sb0JBQW9CQyxRQUFPLE9BQU87QUFBQSxFQUN0QyxNQUFNQSxRQUFPO0FBQUEsRUFDYixPQUFPQSxRQUFPO0FBQUEsSUFDWkEsUUFBTztBQUFBLE1BQ0xBLFFBQU8sT0FBTztBQUFBLFFBQ1osTUFBTUEsUUFBTyxRQUFRLE1BQU07QUFBQSxRQUMzQixLQUFLQSxRQUFPO0FBQUEsUUFDWixXQUFXQSxRQUFPO0FBQUEsUUFDbEIsVUFBVUEsUUFBTyxTQUFTQSxRQUFPLE1BQU07QUFBQSxNQUN6QyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRixDQUFDO0FBRU0sSUFBTSxjQUFjQSxRQUFPLE9BQU87QUFB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RUFDRSxXQUFXLGlCQUFPLEVBQ2xCLFdBQVcsTUFBTTtBQUN0Qjs7O0FEOUlBLElBQU8sb0JBQVEsTUFBTSxLQUFLLE1BQU0sUUFBUSxFQUNyQyxNQUFNLDJCQUEyQixDQUFDLFVBQVUsV0FBVyxDQUFDLEVBQ3hELE1BQU0sdUJBQXVCLENBQUMsVUFBVSxPQUFPLENBQUMsRUFDaEQsTUFBTSxpQ0FBaUMsQ0FBQyxVQUFVLFNBQVMsT0FBTyxDQUFDLEVBQ25FLE1BQU0sWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUMzQixNQUFNLHNDQUFzQztBQUFBLEVBQzNDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRixDQUFDLEVBQ0EsTUFBTSx1QkFBdUIsQ0FBQyxVQUFVLE9BQU8sQ0FBQyxFQUNoRCxNQUFNLHdDQUF3QztBQUFBLEVBQzdDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRixDQUFDLEVBQ0EsTUFBTSxvREFBb0Q7QUFBQSxFQUN6RDtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTdHJ1Y3QiLCAiU2NoZW1hIiwgIlN0cnVjdCIsICJTY2hlbWEiLCAiU3RydWN0IiwgIlNjaGVtYSIsICJTdHJ1Y3QiLCAiTGVhcm5pbmdQcm9ncmFtS2V5U2NoZW1hIiwgIlNjaGVtYSIsICJTdHJ1Y3QiLCAiU2NoZW1hIiwgIlN0cnVjdCIsICJMZWFybmluZ1Byb2dyYW1LZXlTY2hlbWEiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU3RydWN0IiwgIlNjaGVtYSIsICJTdHJ1Y3QiLCAiU2NoZW1hIiwgIlNjaGVtYSIsICJTY2hlbWEiLCAiU2NoZW1hIl0KfQo=
