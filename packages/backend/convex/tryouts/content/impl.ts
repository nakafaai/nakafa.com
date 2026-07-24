import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  MAX_TRYOUT_CONTENT_PLACEMENTS,
  MAX_TRYOUT_CONTENT_RESPONSE_BYTES,
} from "@repo/backend/content/tryout";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePlacement } from "@repo/backend/convex/tryouts/content/artifact";
import {
  type TryoutContentReadArgs,
  type TryoutContentReadResult,
  tryoutContentErrorCode,
  tryoutContentFail,
} from "@repo/backend/convex/tryouts/content/spec";
import { getTryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { getConvexSize } from "convex/values";
import { Effect } from "effect";

/** Requires a migrated attempt to match the exact initiating route identity. */
const validateAttemptIdentity = Effect.fn("tryouts.validateAttemptIdentity")(
  function* (
    attempt: Doc<"tryoutAttempts">,
    input: TryoutContentReadArgs,
    setIdentity: string
  ) {
    if (
      !(
        attempt.countryKey &&
        attempt.examKey &&
        attempt.trackKey &&
        attempt.setKey &&
        attempt.locale &&
        attempt.setIdentity
      )
    ) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.migration,
        "Try-out attempt does not have complete stable content identity."
      );
    }
    if (
      attempt.setIdentity !== setIdentity ||
      attempt.countryKey !== input.countryKey ||
      attempt.examKey !== input.examKey ||
      attempt.trackKey !== input.trackKey ||
      attempt.setKey !== input.setKey ||
      attempt.locale !== input.locale
    ) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.integrity,
        "Try-out attempt identity mismatches the requested route."
      );
    }

    return attempt.locale;
  }
);

/** Reads one attempt-owned section through only stable frozen identities. */
export const readTryoutContent = Effect.fn("tryouts.readTryoutContent")(
  function* (ctx: QueryCtx, input: TryoutContentReadArgs) {
    const setIdentity = tryoutCatalogIdentity({
      countryKey: input.countryKey,
      examKey: input.examKey,
      kind: "set",
      locale: input.locale,
      setKey: input.setKey,
      trackKey: input.trackKey,
    });
    const attempt = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_setIdentity_and_startedAt", (query) =>
          query.eq("userId", input.userId).eq("setIdentity", setIdentity)
        )
        .order("desc")
        .first()
    );
    if (!attempt) {
      return null;
    }

    const locale = yield* validateAttemptIdentity(attempt, input, setIdentity);
    const section = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
          query
            .eq("tryoutAttemptId", attempt._id)
            .eq("sectionKey", input.sectionKey)
        )
        .unique()
    );
    if (!section) {
      return null;
    }

    const access = getTryoutSectionContentAccess(
      attempt.status,
      section.status
    );
    if (!access.questions) {
      return null;
    }
    if (
      !Number.isSafeInteger(section.totalQuestions) ||
      section.totalQuestions < 1 ||
      section.totalQuestions > MAX_TRYOUT_CONTENT_PLACEMENTS
    ) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.limit,
        "Try-out section question count exceeds the runtime limit."
      );
    }

    const placements = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (query) =>
            query
              .eq("tryoutAttemptId", attempt._id)
              .eq("sectionKey", input.sectionKey)
        )
        .take(section.totalQuestions + 1)
    );
    if (placements.length !== section.totalQuestions) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.migration,
        "Try-out section placements do not match its frozen question count."
      );
    }

    const artifacts = yield* Effect.forEach(placements, (placement) =>
      resolvePlacement(ctx, {
        includeAnswer: access.answers,
        locale,
        placement,
        sectionKey: input.sectionKey,
      })
    );
    const result: TryoutContentReadResult = { artifacts };
    if (getConvexSize(result) > MAX_TRYOUT_CONTENT_RESPONSE_BYTES) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.limit,
        "Try-out content response exceeds the bounded byte limit."
      );
    }

    return result;
  }
);
