import type {
  ActionCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  AUDIT_INVENTORY,
  type AuditTableName,
  CUTOVER_AUDIT_PAGE_BYTES,
  CUTOVER_AUDIT_PAGE_SIZE,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  makeFunctionReference,
  type PaginationOptions,
  paginationOptsValidator,
} from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

interface CountPageResult {
  readonly count: number;
  readonly cursor: string;
  readonly done: boolean;
}

const countPageResultValidator = v.object({
  count: v.number(),
  cursor: v.string(),
  done: v.boolean(),
});
const countPageReference = makeFunctionReference<
  "query",
  { paginationOpts: PaginationOptions; table: string },
  CountPageResult
>("contentRelease/cutover/scan:countPage");
const retainedPageReference = makeFunctionReference<
  "query",
  { kind: "catalog" | "placement"; paginationOpts: PaginationOptions },
  CountPageResult
>("contentRelease/cutover/scan:retainedPage");

/** Reads one bounded table page and returns only count evidence. */
export const countPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator, table: v.string() },
  returns: countPageResultValidator,
  handler: (ctx, args) => runConvexProgram(countPageProgram(ctx, args)),
});

/** Reads one bounded retained try-out source page without returning old bytes. */
export const retainedPage = internalQuery({
  args: {
    kind: v.union(v.literal("catalog"), v.literal("placement")),
    paginationOpts: paginationOptsValidator,
  },
  returns: countPageResultValidator,
  handler: (ctx, args) => runConvexProgram(retainedPageProgram(ctx, args)),
});

/** Counts one bounded historical family through its exact snapshot index. */
const retainedPageProgram = Effect.fn("contentRelease.cutover.retainedPage")(
  function* (
    ctx: QueryCtx,
    args: {
      readonly kind: "catalog" | "placement";
      readonly paginationOpts: PaginationOptions;
    }
  ) {
    if (args.kind === "catalog") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutCatalog")
          .withIndex("by_snapshotId_and_index", (index) =>
            index.eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
          )
          .paginate(args.paginationOpts)
      );
      return pageResult(page);
    }
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (index) =>
          index.eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
        )
        .paginate(args.paginationOpts)
    );
    return pageResult(page);
  }
);

/** Counts one audited table through bounded read-only transactions. */
export function countAuditedTable(ctx: ActionCtx, table: AuditTableName) {
  return countPages((paginationOpts) =>
    callInternal(() =>
      ctx.runQuery(countPageReference, { paginationOpts, table })
    )
  );
}

/** Counts one retained source partition through its exact snapshot index. */
export function countRetainedTryoutRows(
  ctx: ActionCtx,
  kind: "catalog" | "placement"
) {
  return countPages((paginationOpts) =>
    callInternal(() =>
      ctx.runQuery(retainedPageReference, { kind, paginationOpts })
    )
  );
}

/** Counts bounded pages without carrying source documents across transactions. */
function countPages(
  loadPage: (
    paginationOpts: PaginationOptions
  ) => Effect.Effect<CountPageResult, ReleaseError>
) {
  return Effect.gen(function* () {
    let count = 0;
    let cursor: null | string = null;
    while (true) {
      const page: CountPageResult = yield* loadPage({
        cursor,
        maximumBytesRead: CUTOVER_AUDIT_PAGE_BYTES,
        maximumRowsRead: CUTOVER_AUDIT_PAGE_SIZE,
        numItems: CUTOVER_AUDIT_PAGE_SIZE,
      });
      count += page.count;
      if (page.done) {
        return count;
      }
      cursor = page.cursor;
    }
  });
}

/** Resolves one audited table name before constructing its typed query. */
const countPageProgram = Effect.fn("contentRelease.cutover.countPage")(
  function* (
    ctx: QueryCtx,
    args: { paginationOpts: PaginationOptions; table: string }
  ) {
    const entry = AUDIT_INVENTORY.find(({ table }) => table === args.table);
    if (!entry) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Cutover audit: unknown table ${args.table}.`
      );
    }
    const page = yield* Effect.promise(() =>
      ctx.db.query(entry.table).paginate(args.paginationOpts)
    );
    return pageResult(page);
  }
);

/** Projects pagination metadata without exposing any stored document bytes. */
function pageResult(page: {
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly page: readonly unknown[];
}) {
  return {
    count: page.page.length,
    cursor: page.continueCursor,
    done: page.isDone,
  };
}
