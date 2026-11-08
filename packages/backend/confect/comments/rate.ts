import type { GenericId } from "@confect/core";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { CommentWriteError } from "@repo/backend/confect/comments/errors";
import { Effect } from "effect";

/**
 * The writes one learner makes on comments. A token bucket refills evenly, so each limit is the number
 * of writes a minute, and its capacity lets a burst through: ten comments or edits, sixty likes, ten
 * reports and twenty-four files, which are twelve photos with their small copies, three comments of
 * four. A person types slower than any of these, so only a script meets them.
 */
const limits = new RateLimiter(components.agentRateLimiter, {
  commentLike: { capacity: 60, kind: "token bucket", period: MINUTE, rate: 60 },
  commentPhoto: {
    capacity: 24,
    kind: "token bucket",
    period: MINUTE,
    rate: 24,
  },
  commentReport: {
    capacity: 10,
    kind: "token bucket",
    period: MINUTE,
    rate: 10,
  },
  commentWrite: {
    capacity: 10,
    kind: "token bucket",
    period: MINUTE,
    rate: 10,
  },
});

/** The kind of comment write that one limit counts. */
type CommentLimit =
  | "commentLike"
  | "commentPhoto"
  | "commentReport"
  | "commentWrite";

/** Counts one write of a learner against its limit, and refuses it once the learner has run out. */
export const spendCommentWrite = Effect.fn("comments.rate.spend")(function* (
  kind: CommentLimit,
  userId: GenericId.GenericId<"users">
) {
  const ctx = yield* MutationCtx;
  const quota = yield* Effect.tryPromise(() =>
    limits.limit(ctx, kind, { key: userId })
  ).pipe(Effect.orDie);
  if (!quota.ok) {
    return yield* new CommentWriteError({
      code: "COMMENT_RATE_LIMITED",
      message: "Too many writes in a minute. Try again shortly.",
    });
  }
});
