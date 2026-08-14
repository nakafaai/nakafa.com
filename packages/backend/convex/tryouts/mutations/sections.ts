import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ensureTryoutLifecycleWritable } from "@repo/backend/convex/contentRelease/cutover/tryouts";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import {
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/convex/tryouts/runtime/score";
import {
  requireActiveSectionAttempt,
  startSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

const SECTION_COMPLETED_RESULT = "completed";
const SECTION_STARTED_RESULT = "started";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
const sectionCompletedResult = Object.freeze({
  kind: SECTION_COMPLETED_RESULT,
});

/** Returns the submitted or expired end reason for a section timer. */
function getSectionEndReason(
  section: TryoutSectionAttempt,
  now: number
): TryoutEndReason {
  if (now >= section.expiresAt) {
    return "time-expired";
  }

  return "submitted";
}

/** Starts one section attempt and its timer inside an active try-out attempt. */
export const start = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    kind: v.literal(SECTION_STARTED_RESULT),
  }),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* ensureTryoutLifecycleWritable(ctx).pipe(
          Effect.mapError(toTryoutRuntimeError)
        );
        const { appUser } = yield* tryRuntimePromise(() => requireAuth(ctx));
        const attempt = yield* requireOwnedAttempt(ctx, {
          attemptId: args.attemptId,
          userId: appUser._id,
        });
        const now = yield* Clock.currentTimeMillis;

        return yield* startSectionAttempt(ctx, {
          attempt,
          now,
          sectionKey: args.sectionKey,
        });
      })
    ),
});

/** Completes one section and finalizes the attempt when no sections remain. */
export const complete = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    kind: v.literal(SECTION_COMPLETED_RESULT),
  }),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* ensureTryoutLifecycleWritable(ctx).pipe(
          Effect.mapError(toTryoutRuntimeError)
        );
        const { appUser } = yield* tryRuntimePromise(() => requireAuth(ctx));
        const attempt = yield* requireOwnedAttempt(ctx, {
          attemptId: args.attemptId,
          userId: appUser._id,
        });
        if (attempt.status !== "in-progress") {
          return yield* new TryoutRuntimeError({
            code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
            message: "Try-out attempt is not active.",
          });
        }

        const now = yield* Clock.currentTimeMillis;
        if (now >= getAttemptExpiresAt(attempt)) {
          return yield* new TryoutRuntimeError({
            code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
            message: "Try-out attempt time has expired.",
          });
        }

        const section = yield* requireActiveSectionAttempt(ctx, {
          attempt,
          sectionKey: args.sectionKey,
        });
        yield* finalizeSectionAttempt(ctx, {
          attempt,
          endReason: getSectionEndReason(section, now),
          now,
          section,
        });

        return sectionCompletedResult;
      })
    ),
});
