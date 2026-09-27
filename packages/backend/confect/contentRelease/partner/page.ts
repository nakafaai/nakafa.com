import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  decodePartnerCursor,
  encodePartnerCursor,
  type PartnerCursor,
  type PartnerFamily,
} from "@repo/backend/confect/contentRelease/partner/cursor";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { verifyArticle } from "@repo/backend/content/article/verify";
import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

const PARTNER_PAGE_LIMIT = 100;
interface PartnerPageInput {
  readonly appLocale: Doc<"contentPaths">["appLocale"];
  readonly cursor: string | null;
  readonly family: PartnerFamily;
  readonly limit: number;
  readonly prefix: string;
}
interface ValidatedPartnerPageInput extends Omit<PartnerPageInput, "cursor"> {
  readonly cursor: PartnerCursor | null;
}
interface PartnerCatalogRow {
  readonly appLocale: Doc<"contentPaths">["appLocale"];
  readonly contentKey: string;
  readonly publicPath: string;
}
interface PartnerRange {
  readonly inclusive: boolean;
  readonly lower: string;
  readonly upper: string;
}
interface PartnerCatalogSource<Row extends PartnerCatalogRow> {
  readonly readDescendants: (
    range: PartnerRange,
    limit: number
  ) => Effect.Effect<readonly Row[]>;
  readonly readExact: () => Effect.Effect<null | Row>;
  readonly verify: (row: Row) => Effect.Effect<unknown, ReleaseError>;
}

/** Checks exact-or-descendant content-key membership without sibling bleed. */
function matchesPrefix(contentKey: string, prefix: string) {
  return (
    prefix === "" ||
    contentKey === prefix ||
    contentKey.startsWith(`${prefix}/`)
  );
}

/** Normalizes one partner prefix before using it in indexed range reads. */
function normalizePrefix(prefix: string) {
  return prefix.split("/").filter(Boolean).join("/");
}

/** Returns the segment-safe indexed range after one validated cursor. */
function prefixRange(input: ValidatedPartnerPageInput): PartnerRange {
  const prefixStart = input.prefix === "" ? "" : `${input.prefix}/`;
  const cursor = input.cursor?.contentKey ?? null;
  if (cursor === null || cursor === input.prefix) {
    return {
      inclusive: true,
      lower: prefixStart,
      upper: `${prefixStart}\uffff`,
    };
  }
  return {
    inclusive: false,
    lower: cursor,
    upper: `${prefixStart}\uffff`,
  };
}

/** Validates one bounded current partner request and its opaque cursor. */
const validatePartnerPageInput = Effect.fn(
  "contentRelease.validatePartnerPage"
)(function* (input: PartnerPageInput) {
  const prefix = normalizePrefix(input.prefix);
  const cursor = yield* decodePartnerCursor(input.cursor);
  const label = input.family === "article" ? "Article" : "Material";
  if (
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > PARTNER_PAGE_LIMIT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `${label} API pages accept 1 to ${PARTNER_PAGE_LIMIT} rows.`
    );
  }
  if (
    cursor !== null &&
    (cursor.family !== input.family ||
      cursor.prefix !== prefix ||
      !matchesPrefix(cursor.contentKey, prefix))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `${label} API cursor does not belong to its requested prefix.`
    );
  }
  return {
    ...input,
    cursor,
    prefix,
  };
});

/** Reads and verifies one bounded exact-or-descendant catalog page. */
const readPartnerRows = Effect.fn("contentRelease.readPartnerRows")(function* <
  Row extends PartnerCatalogRow,
>(input: ValidatedPartnerPageInput, source: PartnerCatalogSource<Row>) {
  const exact =
    input.cursor === null && input.prefix !== ""
      ? yield* source.readExact()
      : null;
  const remaining = input.limit + 1 - (exact === null ? 0 : 1);
  const descendants = yield* source.readDescendants(
    prefixRange(input),
    remaining
  );
  const rows = exact === null ? descendants : [exact, ...descendants];
  yield* Effect.forEach(rows, source.verify);
  return rows;
});

/** Reads one current-only partner page from its authenticated signed catalog. */
export const readPartnerApiPage = Effect.fn(
  "contentRelease.readPartnerApiPage"
)(function* (ctx: QueryCtx, rawInput: PartnerPageInput) {
  const input = yield* validatePartnerPageInput(rawInput);
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const owner =
    input.family === "article"
      ? yield* loadArticleOwner(input.appLocale).pipe(
          Effect.provide(convexArticleLayer(ctx))
        )
      : yield* loadMaterialOwner(input.appLocale).pipe(
          Effect.provide(convexPublicationLayer(ctx))
        );
  const slot = owner.slot;
  if (!(owner.active && owner.managed && slot)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Signed ${input.family}s for ${input.appLocale} are unavailable.`
    );
  }
  const active = owner.active;
  if (
    input.cursor &&
    (input.cursor.activeReleaseId !== active.releaseId ||
      input.cursor.appLocale !== input.appLocale)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      `The active ${input.family} release changed during partner API pagination.`
    );
  }
  let rows: readonly PartnerCatalogRow[];
  if (input.family === "article") {
    rows = yield* readPartnerRows<Doc<"articleCatalog">>(input, {
      readDescendants: (range, limit) =>
        database
          .table("articleCatalog")
          .index("by_slot_and_appLocale_and_contentKey", (index) => {
            const appLocale = index
              .eq("slot", slot)
              .eq("appLocale", input.appLocale);
            const lower = range.inclusive
              ? appLocale.gte("contentKey", range.lower)
              : appLocale.gt("contentKey", range.lower);
            return lower.lt("contentKey", range.upper);
          })
          .take(limit)
          .pipe(Effect.orDie),
      readExact: () =>
        database
          .table("articleCatalog")
          .get(
            "by_slot_and_appLocale_and_contentKey",
            slot,
            input.appLocale,
            input.prefix
          )
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
      verify: (row) =>
        verifyArticle(row, active.sequence).pipe(
          Effect.provide(convexArticleLayer(ctx))
        ),
    });
  } else {
    rows = yield* readPartnerRows<Doc<"materialCatalog">>(input, {
      readDescendants: (range, limit) =>
        database
          .table("materialCatalog")
          .index("by_slot_and_appLocale_and_contentKey", (index) => {
            const appLocale = index
              .eq("slot", slot)
              .eq("appLocale", input.appLocale);
            const lower = range.inclusive
              ? appLocale.gte("contentKey", range.lower)
              : appLocale.gt("contentKey", range.lower);
            return lower.lt("contentKey", range.upper);
          })
          .take(limit)
          .pipe(Effect.orDie),
      readExact: () =>
        database
          .table("materialCatalog")
          .get(
            "by_slot_and_appLocale_and_contentKey",
            slot,
            input.appLocale,
            input.prefix
          )
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
      verify: verifyMaterial,
    });
  }
  const selected = rows.slice(0, input.limit);
  const isDone = rows.length <= input.limit;
  let continueCursor = "";
  if (!isDone) {
    // Positive page limits guarantee a selected row whenever lookahead exists.
    const last = yield* Effect.fromNullishOr(selected.at(-1)).pipe(
      Effect.orDie
    );
    continueCursor = yield* encodePartnerCursor({
      appLocale: input.appLocale,
      activeReleaseId: active.releaseId,
      contentKey: last.contentKey,
      family: input.family,
      prefix: input.prefix,
    });
  }
  return {
    activeReleaseId: active.releaseId,
    continueCursor,
    isDone,
    page: selected.map((row) => ({
      appLocale: row.appLocale,
      publicPath: row.publicPath,
    })),
  };
});
