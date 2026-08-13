import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
import {
  historyLocaleReceiptValidator,
  historyWrite,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

type LocaleTarget = "attempt" | "progress";

/** Copies required legacy locale into the additive current locale field. */
export const migrateAppLocale = Effect.fn("tryouts.history.migrateAppLocale")(
  function* (
    ctx: MutationCtx,
    plan: RetainedTryoutHistoryPlan,
    target: LocaleTarget
  ) {
    const inventory = yield* authenticateRetainedTryoutHistory(ctx, plan);
    const rows =
      target === "attempt" ? inventory.attempts : inventory.progressRows;
    let updated = 0;
    for (const row of rows) {
      if (row.appLocale !== undefined) {
        continue;
      }
      yield* historyWrite(`Unable to migrate app locale for ${target}.`, () =>
        ctx.db.patch(row._id, { appLocale: row.locale })
      );
      updated += 1;
    }

    return {
      done: true,
      nextCursor: null,
      processed: rows.length,
      target,
      updated,
    };
  }
);

/** Internal exact migration step for attempts or progress rows. */
export const migrate = internalMutation({
  args: {
    target: v.union(v.literal("attempt"), v.literal("progress")),
  },
  returns: historyLocaleReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* requireCutoverPhase(ctx, ["legacy-drained"]);
        return yield* migrateAppLocale(
          ctx,
          retainedTryoutHistoryPlan,
          args.target
        );
      }).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
