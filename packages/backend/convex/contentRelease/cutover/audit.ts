import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  type AuditFacts,
  validateQuiescentPublication,
} from "@repo/backend/convex/contentRelease/cutover/facts";
import {
  AUDIT_INVENTORY,
  CUTOVER_INVENTORY_VERSION,
  RETAINED_CATALOG_COUNT,
  RETAINED_PLACEMENT_COUNT,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import {
  countAuditedTable,
  countRetainedTryoutRows,
} from "@repo/backend/convex/contentRelease/cutover/scan";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const auditReceiptValidator = v.object({
  complete: v.boolean(),
  inventoryVersion: v.literal(CUTOVER_INVENTORY_VERSION),
});
const factsReference = makeFunctionReference<
  "query",
  Record<string, never>,
  AuditFacts
>("contentRelease/cutover/facts:facts");

/** Proves the complete hardcoded production inventory without returning bytes. */
export const audit = internalAction({
  args: {},
  returns: auditReceiptValidator,
  handler: (ctx) => runConvexActionProgram(auditProgram(ctx)),
});

/** Shared read-only audit used before the first destructive legacy page. */
export const auditProgram = Effect.fn("contentRelease.cutover.audit")(
  function* (ctx: ActionCtx) {
    for (const entry of AUDIT_INVENTORY) {
      const count = yield* countAuditedTable(ctx, entry.table);
      if (count !== entry.expected) {
        return yield* inventoryFailure(
          `${entry.table} expected ${entry.expected} rows but found ${count}.`
        );
      }
    }
    const catalog = yield* countRetainedTryoutRows(ctx, "catalog");
    const placements = yield* countRetainedTryoutRows(ctx, "placement");
    if (
      catalog !== RETAINED_CATALOG_COUNT ||
      placements !== RETAINED_PLACEMENT_COUNT
    ) {
      return yield* inventoryFailure(
        "Retained try-out source rows differ from the production audit."
      );
    }
    const proof = yield* callInternal(() => ctx.runQuery(factsReference, {}));
    yield* validateQuiescentPublication(proof);
    const complete = true;
    return { complete, inventoryVersion: CUTOVER_INVENTORY_VERSION };
  }
);

/** Creates one stable fail-closed production inventory error. */
function inventoryFailure(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", `Cutover audit: ${message}`);
}
