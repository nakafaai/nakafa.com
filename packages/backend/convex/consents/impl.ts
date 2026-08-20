import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type {
  ConsentCategory,
  ConsentDecision,
  ConsentWrite,
} from "@repo/backend/convex/consents/schema";
import { Clock, Effect, Schema } from "effect";

const consentPersistenceFailedCode = "CONSENT_PERSISTENCE_FAILED";
const consentPersistenceFailedMessage =
  "Unable to read or persist account consent.";
type ConsentReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type SaveConsentInput = ConsentWrite & {
  readonly userId: Id<"users">;
};

/** Raised when account consent state cannot be read or persisted safely. */
export class ConsentPersistenceError extends Schema.TaggedError<ConsentPersistenceError>()(
  "ConsentPersistenceError",
  {
    code: Schema.Literal(consentPersistenceFailedCode),
    message: Schema.Literal(consentPersistenceFailedMessage),
  }
) {}

/** Maps a Convex database failure into the consent domain error channel. */
function toConsentPersistenceError() {
  return new ConsentPersistenceError({
    code: consentPersistenceFailedCode,
    message: consentPersistenceFailedMessage,
  });
}

/** Loads the one decision owned by an account and consent category. */
const loadConsentDocument = Effect.fn("consents.loadConsentDocument")(
  function* (
    ctx: ConsentReadCtx,
    userId: Id<"users">,
    category: ConsentCategory
  ) {
    return yield* Effect.tryPromise({
      catch: toConsentPersistenceError,
      try: () =>
        ctx.db
          .query("accountConsents")
          .withIndex("by_userId_and_category", (query) =>
            query.eq("userId", userId).eq("category", category)
          )
          .unique(),
    });
  }
);

/** Projects storage identity out of the public consent contract. */
function toConsentDecision(consent: Doc<"accountConsents">): ConsentDecision {
  if (consent.mechanism === ANALYTICS_BROWSER_SIGNAL_MECHANISM) {
    return {
      category: consent.category,
      decidedAt: consent.decidedAt,
      granted: false,
      mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
      noticeVersion: consent.noticeVersion,
    };
  }

  return {
    category: consent.category,
    decidedAt: consent.decidedAt,
    granted: consent.granted,
    mechanism: ANALYTICS_CONSENT_MECHANISM,
    noticeVersion: consent.noticeVersion,
  };
}

/** Builds a schema-valid decision while retaining the mechanism invariant. */
function createConsentDecision(
  input: ConsentWrite,
  decidedAt: number
): ConsentDecision {
  if (input.mechanism === ANALYTICS_BROWSER_SIGNAL_MECHANISM) {
    return {
      category: input.category,
      decidedAt,
      granted: false,
      mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
      noticeVersion: input.noticeVersion,
    };
  }

  return {
    category: input.category,
    decidedAt,
    granted: input.granted,
    mechanism: ANALYTICS_CONSENT_MECHANISM,
    noticeVersion: input.noticeVersion,
  };
}

/** Reads the current decision for one authenticated account category. */
export const readCurrentConsent = Effect.fn("consents.readCurrentConsent")(
  function* (
    ctx: ConsentReadCtx,
    userId: Id<"users">,
    category: ConsentCategory
  ) {
    const consent = yield* loadConsentDocument(ctx, userId, category);
    return consent ? toConsentDecision(consent) : null;
  }
);

/** Checks an exact current-version grant and fails closed for missing state. */
export const hasCurrentConsent = Effect.fn("consents.hasCurrentConsent")(
  function* (
    ctx: ConsentReadCtx,
    userId: Id<"users">,
    category: ConsentCategory
  ) {
    const consent = yield* readCurrentConsent(ctx, userId, category);
    return (
      consent?.granted === true &&
      consent.noticeVersion === ANALYTICS_CONSENT_NOTICE_VERSION
    );
  }
);

/** Atomically appends provenance and refreshes the current consent gate. */
export const saveCurrentConsent = Effect.fn("consents.saveCurrentConsent")(
  function* (ctx: MutationCtx, input: SaveConsentInput) {
    const current = yield* loadConsentDocument(
      ctx,
      input.userId,
      input.category
    );
    if (
      current?.granted === input.granted &&
      current.mechanism === input.mechanism &&
      current.noticeVersion === input.noticeVersion
    ) {
      return toConsentDecision(current);
    }

    const decision = createConsentDecision(
      input,
      yield* Clock.currentTimeMillis
    );
    const stored = {
      ...decision,
      userId: input.userId,
    };

    yield* Effect.tryPromise({
      catch: toConsentPersistenceError,
      try: () => ctx.db.insert("accountConsentDecisions", stored),
    });

    if (current) {
      yield* Effect.tryPromise({
        catch: toConsentPersistenceError,
        try: () => ctx.db.replace("accountConsents", current._id, stored),
      });
    } else {
      yield* Effect.tryPromise({
        catch: toConsentPersistenceError,
        try: () => ctx.db.insert("accountConsents", stored),
      });
    }

    return decision;
  }
);
