import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import {
  decodePartnerCursor,
  encodePartnerCursor,
  type PartnerCursor,
} from "@repo/backend/convex/contentRelease/partner/cursor";
import { Effect } from "effect";

const PARTNER_PAGE_LIMIT = 100;

type PartnerFamily = "article" | "material";

interface PartnerPageInput {
  readonly cursor: string | null;
  readonly family: PartnerFamily;
  readonly limit: number;
  readonly locale: ContentLocale;
  readonly prefix: string;
}

interface ValidatedPartnerPageInput extends Omit<PartnerPageInput, "cursor"> {
  readonly cursor: PartnerCursor | null;
}

interface PartnerCatalogRow {
  readonly contentKey: string;
  readonly locale: ContentLocale;
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
  ) => Promise<Row[]>;
  readonly readExact: () => Promise<null | Row>;
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
  return { ...input, cursor, prefix };
});

/** Reads and verifies one bounded exact-or-descendant catalog page. */
const readPartnerRows = Effect.fn("contentRelease.readPartnerRows")(function* <
  Row extends PartnerCatalogRow,
>(input: ValidatedPartnerPageInput, source: PartnerCatalogSource<Row>) {
  const exact =
    input.cursor === null && input.prefix !== ""
      ? yield* Effect.promise(source.readExact)
      : null;
  const remaining = input.limit + 1 - (exact === null ? 0 : 1);
  const descendants = yield* Effect.promise(() =>
    source.readDescendants(prefixRange(input), remaining)
  );
  const rows = exact === null ? descendants : [exact, ...descendants];
  if (rows.some((row) => !matchesPrefix(row.contentKey, input.prefix))) {
    const label = input.family === "article" ? "Article" : "Material";
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `${label} API catalog scan escaped its requested prefix.`
    );
  }
  yield* Effect.forEach(rows, source.verify);
  return rows;
});

/** Reads one current-only partner page from its authenticated signed catalog. */
export const readPartnerApiPage = Effect.fn(
  "contentRelease.readPartnerApiPage"
)(function* (ctx: QueryCtx, rawInput: PartnerPageInput) {
  const input = yield* validatePartnerPageInput(rawInput);
  const owner =
    input.family === "article"
      ? yield* loadArticleOwner(ctx, input.locale)
      : yield* loadMaterialOwner(ctx, input.locale);
  if (!(owner.active && owner.managed)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Signed ${input.family}s for ${input.locale} are unavailable.`
    );
  }
  const active = owner.active;
  if (
    input.cursor &&
    (input.cursor.activeReleaseId !== active.releaseId ||
      input.cursor.locale !== input.locale)
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
        ctx.db
          .query("articleCatalog")
          .withIndex("by_contentKey_and_locale", (index) => {
            const lower = range.inclusive
              ? index.gte("contentKey", range.lower)
              : index.gt("contentKey", range.lower);
            return lower.lt("contentKey", range.upper);
          })
          .filter((filter) => filter.eq(filter.field("locale"), input.locale))
          .take(limit),
      readExact: () =>
        ctx.db
          .query("articleCatalog")
          .withIndex("by_contentKey_and_locale", (index) =>
            index.eq("contentKey", input.prefix).eq("locale", input.locale)
          )
          .unique(),
      verify: (row) => verifyArticle(ctx, row, active.sequence),
    });
  } else {
    rows = yield* readPartnerRows<Doc<"materialCatalog">>(input, {
      readDescendants: (range, limit) =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_locale_and_contentKey", (index) => {
            const locale = index.eq("locale", input.locale);
            const lower = range.inclusive
              ? locale.gte("contentKey", range.lower)
              : locale.gt("contentKey", range.lower);
            return lower.lt("contentKey", range.upper);
          })
          .take(limit),
      readExact: () =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_locale_and_contentKey", (index) =>
            index.eq("locale", input.locale).eq("contentKey", input.prefix)
          )
          .unique(),
      verify: verifyMaterial,
    });
  }

  const selected = rows.slice(0, input.limit);
  const isDone = rows.length <= input.limit;
  let continueCursor = "";
  if (!isDone) {
    const last = selected.at(-1);
    if (!last) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `The ${input.family} partner page lost its continuation row.`
      );
    }
    continueCursor = yield* encodePartnerCursor({
      activeReleaseId: active.releaseId,
      contentKey: last.contentKey,
      family: input.family,
      locale: input.locale,
      prefix: input.prefix,
    });
  }
  return {
    activeReleaseId: active.releaseId,
    continueCursor,
    isDone,
    page: selected.map((row) => ({
      locale: row.locale,
      publicPath: row.publicPath,
    })),
  };
});
