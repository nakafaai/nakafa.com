import { DatabaseReader, DatabaseWriter } from "@confect/server";
import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type {
  ConsentCategory,
  ConsentDecision,
  ConsentWrite,
} from "@repo/backend/confect/consents/schema";
import {
  ConsentPersistenceError,
  consentPersistenceFailedCode,
  consentPersistenceFailedMessage,
} from "@repo/backend/confect/consents/schema";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Clock, Effect, flow } from "effect";

type ConsentReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type SaveConsentInput = ConsentWrite & {
  readonly userId: Id<"users">;
};

/** Raised when account consent state cannot be read or persisted safely. */

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
    return yield* DatabaseReader.make(databaseSchema, ctx.db)
      .table("accountConsents")
      .get("by_userId_and_category", userId, category)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie,
        Effect.catchDefect(flow(toConsentPersistenceError, Effect.fail))
      );
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
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
    yield* writer
      .table("accountConsentDecisions")
      .insert(stored)
      .pipe(Effect.orDie);
    if (current) {
      yield* writer
        .table("accountConsents")
        .replace(current._id, stored)
        .pipe(Effect.orDie);
    } else {
      yield* writer.table("accountConsents").insert(stored).pipe(Effect.orDie);
    }
    return decision;
  },
  Effect.catchDefect(flow(toConsentPersistenceError, Effect.fail))
);
