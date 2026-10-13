import { RegisteredFunction } from "@confect/server";
import type { Doc } from "@repo/backend/components/betterAuth/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/components/betterAuth/_generated/server";
import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import schema from "@repo/backend/components/betterAuth/schema";
import { noProviderTokens } from "@repo/backend/confect/auth/tokens";
import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import {
  Array as Arr,
  Effect,
  Scheduler as EffectScheduler,
  Predicate,
  Record as Rec,
} from "effect";

/**
 * Accounts one call reads. A call reads that many documents and writes at most
 * that many, against the 32,000 scanned and 16,000 written that Convex allows
 * one mutation (https://docs.convex.dev/production/state/limits).
 */
export const CLEAR_PAGE_SIZE = 100;

/** Whether an account row still holds anything a provider issued at sign-in. */
function holdsProviderToken(account: Doc<"account">) {
  return Arr.some(Rec.keys(noProviderTokens), (field) =>
    Predicate.isNotNullish(account[field])
  );
}

/**
 * Counts one page of accounts that hold a provider token, and clears them
 * unless `dry`. Convex removes a field that `patch` sets to `undefined`
 * (https://docs.convex.dev/database/writing-data).
 */
const clearPageProgram = Effect.fn("betterAuth.tokens.clearPage")(function* (
  ctx: MutationCtx,
  cursor: string | null,
  dry: boolean
) {
  const page = yield* Effect.promise(() =>
    stream(ctx.db, schema).query("account").paginate({
      cursor,
      numItems: CLEAR_PAGE_SIZE,
    })
  );
  const holding = Arr.filter(page.page, holdsProviderToken);
  if (!dry) {
    yield* Effect.forEach(
      holding,
      (account) =>
        Effect.promise(() =>
          ctx.db.patch("account", account._id, noProviderTokens)
        ),
      { discard: true }
    );
  }
  return {
    cleared: dry ? 0 : holding.length,
    holding: holding.length,
    next: page.isDone ? null : page.continueCursor,
    scanned: page.page.length,
  };
});

/**
 * Temporary maintenance function. Sign-in used to store the Google access,
 * refresh and ID tokens and their expiry times on every `account` row, and the
 * rows written before the account hooks (`confect/auth/tokens.ts`) still hold
 * them. The hooks never touch a row they do not write.
 *
 * One call reads one page of `account` rows after `cursor` and counts them:
 * `scanned` rows read, and `holding` of them with any of the five columns set.
 * With `dry` set it writes nothing. Without it, it removes the five columns
 * from each holding row, counts those rows in `cleared`, and leaves every other
 * row and every other column alone, so it can run again at any point. Start
 * with `{ cursor: null, dry: true }` and send each `next` back as the `cursor`
 * of the following call until it is null, which means there are no more rows.
 *
 * Run it with `convex run --component betterAuth tokens:clearPage`. On
 * production, run it only after the release that adds the account hooks is
 * live, or the next sign-in stores a token again.
 *
 * Owner: ADR 0009. Exit: it has run on dev and on production, and a dry pass
 * over every account finds no row that holds a token. Cleanup: delete this
 * function and its test in the change that records the production result, and
 * stop exporting `noProviderTokens`, which only this function reads outside its
 * own module.
 */
export const clearPage = mutation({
  args: {
    cursor: v.union(v.null(), v.string()),
    dry: v.boolean(),
  },
  returns: v.object({
    cleared: v.number(),
    holding: v.number(),
    next: v.union(v.null(), v.string()),
    scanned: v.number(),
  }),
  handler: (ctx, args) =>
    clearPageProgram(ctx, args.cursor, args.dry).pipe(
      Effect.withTracerTiming(false),
      RegisteredFunction.runHandlerPromise(undefined, {
        scheduler: new EffectScheduler.MixedScheduler("sync"),
      })
    ),
});
