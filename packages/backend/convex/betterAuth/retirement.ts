import type { Id } from "@repo/backend/convex/betterAuth/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/betterAuth/_generated/server";
import {
  mutation,
  query,
} from "@repo/backend/convex/betterAuth/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect, Schema } from "effect";

const RETIREMENT_PAGE_SIZE = 32;
const RETIREMENT_PAGE_BYTES = 4 * 1024 * 1024;
const RESET_PASSWORD_PREFIX = "reset-password:";
const RESET_PASSWORD_UPPER_BOUND = "reset-password;";
const retirementTargetValidator = literals(
  "credentials",
  "resets",
  "usernames"
);
const auditResultValidator = v.object({
  blocked: v.number(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  matched: v.number(),
  scanned: v.number(),
});
const retirementResultValidator = auditResultValidator.extend({
  retired: v.number(),
});

type RetirementTarget = "credentials" | "resets" | "usernames";

/** Expected component cleanup failure without row details or provider data. */
class BetterAuthRetirementError extends Schema.TaggedError<BetterAuthRetirementError>()(
  "BetterAuthRetirementError",
  {
    code: Schema.Literal("BETTER_AUTH_RETIREMENT_FAILED"),
    message: Schema.String,
  }
) {}

/** Owns the fixed transaction budget for every temporary retirement page. */
function retirementPageOptions(cursor: string | null) {
  return {
    cursor,
    maximumBytesRead: RETIREMENT_PAGE_BYTES,
    maximumRowsRead: RETIREMENT_PAGE_SIZE,
    numItems: RETIREMENT_PAGE_SIZE,
  } as const;
}

/** Maps component database failures to one aggregate-only rollout error. */
function runRetirementOperation<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () =>
      new BetterAuthRetirementError({
        code: "BETTER_AUTH_RETIREMENT_FAILED",
        message: "Unable to process Better Auth retirement evidence.",
      }),
    try: operation,
  });
}

function hasUsernameFields(user: {
  readonly displayUsername?: null | string;
  readonly username?: null | string;
}) {
  return user.username !== undefined || user.displayUsername !== undefined;
}

/** Reads credential rows and proves exactly one Google recovery link per row. */
const readCredentialPage = Effect.fn("betterAuth.retirement.readCredentials")(
  function* (ctx: QueryCtx, cursor: string | null) {
    const page = yield* runRetirementOperation(() =>
      ctx.db
        .query("account")
        .withIndex("providerId_userId", (index) =>
          index.eq("providerId", "credential")
        )
        .paginate(retirementPageOptions(cursor))
    );
    const recoverable: Id<"account">[] = [];
    let blocked = 0;

    for (const account of page.page) {
      const googleAccounts = yield* runRetirementOperation(() =>
        ctx.db
          .query("account")
          .withIndex("providerId_userId", (index) =>
            index.eq("providerId", "google").eq("userId", account.userId)
          )
          .take(2)
      );
      if (googleAccounts.length === 1) {
        recoverable.push(account._id);
      } else {
        blocked += 1;
      }
    }

    return { blocked, page, recoverable };
  }
);

/** Reads only Better Auth's reset-password verification namespace. */
const readResetPage = Effect.fn("betterAuth.retirement.readResets")(function* (
  ctx: QueryCtx,
  cursor: string | null
) {
  return yield* runRetirementOperation(() =>
    ctx.db
      .query("verification")
      .withIndex("identifier", (index) =>
        index
          .gte("identifier", RESET_PASSWORD_PREFIX)
          .lt("identifier", RESET_PASSWORD_UPPER_BOUND)
      )
      .paginate(retirementPageOptions(cursor))
  );
});

/** Reads users in stable creation order because clearing changes an index. */
const readUsernamePage = Effect.fn("betterAuth.retirement.readUsernames")(
  function* (ctx: QueryCtx, cursor: string | null) {
    const page = yield* runRetirementOperation(() =>
      ctx.db.query("user").paginate(retirementPageOptions(cursor))
    );

    return {
      matched: page.page.filter(hasUsernameFields),
      page,
    };
  }
);

/** Reads one bounded page and returns only aggregate retirement evidence. */
const auditRetirementPage = Effect.fn("betterAuth.retirement.audit")(function* (
  ctx: QueryCtx,
  target: RetirementTarget,
  cursor: string | null
) {
  if (target === "credentials") {
    const credentials = yield* readCredentialPage(ctx, cursor);
    return {
      blocked: credentials.blocked,
      continueCursor: credentials.page.continueCursor,
      isDone: credentials.page.isDone,
      matched: credentials.page.page.length,
      scanned: credentials.page.page.length,
    };
  }

  if (target === "resets") {
    const resets = yield* readResetPage(ctx, cursor);
    return {
      blocked: 0,
      continueCursor: resets.continueCursor,
      isDone: resets.isDone,
      matched: resets.page.length,
      scanned: resets.page.length,
    };
  }

  const usernames = yield* readUsernamePage(ctx, cursor);
  return {
    blocked: 0,
    continueCursor: usernames.page.continueCursor,
    isDone: usernames.page.isDone,
    matched: usernames.matched.length,
    scanned: usernames.page.page.length,
  };
});

/** Retires one bounded page while preserving accounts without Google recovery. */
const retirePage = Effect.fn("betterAuth.retirement.retire")(function* (
  ctx: MutationCtx,
  target: RetirementTarget,
  cursor: string | null
) {
  if (target === "credentials") {
    const credentials = yield* readCredentialPage(ctx, cursor);
    for (const accountId of credentials.recoverable) {
      yield* runRetirementOperation(() => ctx.db.delete("account", accountId));
    }
    return {
      blocked: credentials.blocked,
      continueCursor: credentials.page.continueCursor,
      isDone: credentials.page.isDone,
      matched: credentials.page.page.length,
      retired: credentials.recoverable.length,
      scanned: credentials.page.page.length,
    };
  }

  if (target === "resets") {
    const resets = yield* readResetPage(ctx, cursor);
    for (const verification of resets.page) {
      yield* runRetirementOperation(() =>
        ctx.db.delete("verification", verification._id)
      );
    }
    return {
      blocked: 0,
      continueCursor: resets.continueCursor,
      isDone: resets.isDone,
      matched: resets.page.length,
      retired: resets.page.length,
      scanned: resets.page.length,
    };
  }

  const usernames = yield* readUsernamePage(ctx, cursor);
  for (const user of usernames.matched) {
    yield* runRetirementOperation(() =>
      ctx.db.patch("user", user._id, {
        displayUsername: undefined,
        username: undefined,
      })
    );
  }
  return {
    blocked: 0,
    continueCursor: usernames.page.continueCursor,
    isDone: usernames.page.isDone,
    matched: usernames.matched.length,
    retired: usernames.matched.length,
    scanned: usernames.page.page.length,
  };
});

/** Temporary component-only aggregate audit for the credential hard cut. */
export const audit = query({
  args: {
    cursor: v.union(v.null(), v.string()),
    target: retirementTargetValidator,
  },
  returns: auditResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(auditRetirementPage(ctx, args.target, args.cursor)),
});

/** Temporary component-only bounded cleanup after every credential writer is off. */
export const retire = mutation({
  args: {
    cursor: v.union(v.null(), v.string()),
    target: retirementTargetValidator,
  },
  returns: retirementResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(retirePage(ctx, args.target, args.cursor)),
});
