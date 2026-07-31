import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { readExactMaterialSnapshot } from "@repo/backend/convex/contentRelease/material/exact";
import { lookupMaterial } from "@repo/backend/convex/contentRelease/material/lookup";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import type {
  MaterialLookupInput,
  materialApiEntryValidator,
} from "@repo/backend/convex/contentRelease/material/spec";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import {
  formatContentDate,
  getContentAuthors,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const MATERIAL_API_PAGE_LIMIT = 100;

interface MaterialApiPageInput {
  readonly cursor: string | null;
  readonly limit: number;
  readonly locale: Doc<"curriculumLessons">["locale"];
  readonly prefix: string;
}

interface ApiCandidate {
  readonly contentKey: string;
  readonly entry: Infer<typeof materialApiEntryValidator>;
}

/** Checks exact-or-descendant content-key membership without sibling bleed. */
function matchesPrefix(contentKey: string, prefix: string) {
  return (
    prefix === "" ||
    contentKey === prefix ||
    contentKey.startsWith(`${prefix}/`)
  );
}

/** Normalizes one API prefix before using it in indexed range reads. */
function normalizePrefix(prefix: string) {
  return prefix.split("/").filter(Boolean).join("/");
}

/** Returns the segment-safe indexed range after one material page cursor. */
function prefixRange(
  input: Effect.Effect.Success<ReturnType<typeof validatePageInput>>
) {
  const prefixStart = input.prefix === "" ? "" : `${input.prefix}/`;
  if (input.cursor === null || input.cursor === input.prefix) {
    return {
      inclusive: true,
      lower: prefixStart,
      upper: `${prefixStart}\uffff`,
    };
  }
  return {
    inclusive: false,
    lower: input.cursor,
    upper: `${prefixStart}\uffff`,
  };
}

/** Validates one bounded material API page request and its server cursor. */
const validatePageInput = Effect.fn("contentRelease.validateMaterialApiPage")(
  function* (input: MaterialApiPageInput) {
    const prefix = normalizePrefix(input.prefix);
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > MATERIAL_API_PAGE_LIMIT
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Material API pages accept 1 to ${MATERIAL_API_PAGE_LIMIT} rows.`
      );
    }
    if (input.cursor !== null && !matchesPrefix(input.cursor, prefix)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Material API cursor does not belong to its requested prefix."
      );
    }
    return { ...input, prefix };
  }
);

/** Converts one lightweight source route into the established partner API item. */
const readSourceCandidate = Effect.fn(
  "contentRelease.readMaterialSourceApiItem"
)(function* (ctx: QueryCtx, route: Doc<"contentRoutes">) {
  const section = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumLessons")
      .withIndex("by_locale_and_slug", (index) =>
        index.eq("locale", route.locale).eq("slug", route.sourcePath)
      )
      .unique()
  );
  if (!section) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material route ${route.locale}/${route.sourcePath} has no source body.`
    );
  }
  const authors = yield* Effect.tryPromise({
    try: () =>
      getContentAuthors(ctx, {
        contentId: section._id,
        contentType: "material",
      }),
    catch: () =>
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: `Material ${section.locale}/${section.slug} has invalid source authors.`,
      }),
  });
  return {
    contentKey: route.sourcePath,
    entry: {
      item: {
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: section.locale,
        metadata: {
          authors,
          date: formatContentDate(section.date),
          ...(section.description === undefined
            ? {}
            : { description: section.description }),
          ...(section.subject === undefined
            ? {}
            : { subject: section.subject }),
          title: section.title,
        },
        raw: section.body,
        slug: route.sourcePath,
        sourcePath: route.sourcePath,
        url: `${NAKAFA_CONTENT_BASE_URL}/${section.locale}/${route.route}`,
      },
      kind: "source",
    },
  } satisfies ApiCandidate;
});

/** Reads one bounded source range after accounting for exact tombstones. */
const readSourceCandidates = Effect.fn(
  "contentRelease.readMaterialSourceApiPage"
)(function* (
  ctx: QueryCtx,
  input: Effect.Effect.Success<ReturnType<typeof validatePageInput>>,
  claimed: ReadonlySet<string>
) {
  const relevantClaimCount = Array.from(claimed).filter(
    (contentKey) =>
      matchesPrefix(contentKey, input.prefix) &&
      (input.cursor === null || contentKey > input.cursor)
  ).length;
  const scanLimit = input.limit + relevantClaimCount + 1;
  const exact =
    input.cursor === null && input.prefix !== ""
      ? yield* Effect.promise(() =>
          ctx.db
            .query("contentRoutes")
            .withIndex(
              "by_locale_and_section_and_kind_and_sourcePath",
              (index) =>
                index
                  .eq("locale", input.locale)
                  .eq("section", "material")
                  .eq("kind", "curriculum-lesson")
                  .eq("sourcePath", input.prefix)
            )
            .unique()
        )
      : null;
  const range = prefixRange(input);
  const remaining = scanLimit - (exact === null ? 0 : 1);
  const descendants = yield* Effect.promise(() =>
    ctx.db
      .query("contentRoutes")
      .withIndex("by_locale_and_section_and_kind_and_sourcePath", (index) => {
        const sourcePath = index
          .eq("locale", input.locale)
          .eq("section", "material")
          .eq("kind", "curriculum-lesson");
        const lower = range.inclusive
          ? sourcePath.gte("sourcePath", range.lower)
          : sourcePath.gt("sourcePath", range.lower);
        return lower.lt("sourcePath", range.upper);
      })
      .take(remaining)
  );
  const rows = exact === null ? descendants : [exact, ...descendants];
  if (rows.some((row) => !matchesPrefix(row.sourcePath, input.prefix))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Material API source scan escaped its requested prefix."
    );
  }
  const selected = rows
    .filter((row) => !claimed.has(row.sourcePath))
    .slice(0, input.limit + 1);
  const candidates = yield* Effect.forEach(selected, (row) =>
    readSourceCandidate(ctx, row)
  );
  return {
    advanceCursor: rows.at(-1)?.sourcePath ?? null,
    candidates,
    exhausted: rows.length < scanLimit,
  };
});

/** Converts one verified exact projection into a signed-runtime page entry. */
function publishedCandidate(
  material: Effect.Effect.Success<ReturnType<typeof verifyMaterial>> & {
    readonly row: Doc<"materialCatalog">;
  }
): ApiCandidate {
  return {
    contentKey: material.row.contentKey,
    entry: {
      kind: "published",
      locale: material.row.locale,
      publicPath: material.row.publicPath,
    },
  };
}

/** Reads one family-owned API page directly from the active material catalog. */
const readFamilyPage = Effect.fn("contentRelease.readMaterialFamilyApiPage")(
  function* (
    ctx: QueryCtx,
    input: Effect.Effect.Success<ReturnType<typeof validatePageInput>>,
    activeReleaseId: string
  ) {
    const exact =
      input.cursor === null && input.prefix !== ""
        ? yield* Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_locale_and_contentKey", (index) =>
                index.eq("locale", input.locale).eq("contentKey", input.prefix)
              )
              .unique()
          )
        : null;
    const range = prefixRange(input);
    const remaining = input.limit + 1 - (exact === null ? 0 : 1);
    const descendants = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_contentKey", (index) => {
          const locale = index.eq("locale", input.locale);
          const lower = range.inclusive
            ? locale.gte("contentKey", range.lower)
            : locale.gt("contentKey", range.lower);
          return lower.lt("contentKey", range.upper);
        })
        .take(remaining)
    );
    const rows = exact === null ? descendants : [exact, ...descendants];
    if (rows.some((row) => !matchesPrefix(row.contentKey, input.prefix))) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Material API catalog scan escaped its requested prefix."
      );
    }
    const verified = yield* Effect.forEach(rows, (row) =>
      verifyMaterial(row).pipe(Effect.map((material) => ({ ...material, row })))
    );
    return buildPage(
      activeReleaseId,
      input.limit,
      verified.map(publishedCandidate),
      rows.length <= input.limit,
      null
    );
  }
);

/** Builds one stable partner page from ordered reconciled candidates. */
function buildPage(
  activeReleaseId: string | null,
  limit: number,
  candidates: readonly ApiCandidate[],
  exhausted: boolean,
  advanceCursor: string | null
) {
  const ordered = candidates
    .slice()
    .sort((left, right) => left.contentKey.localeCompare(right.contentKey));
  const selected = ordered.slice(0, limit);
  const hasUnreturnedCandidate = ordered.length > limit;
  const isDone = exhausted && !hasUnreturnedCandidate;
  let continueCursor = "";
  if (!isDone) {
    continueCursor = hasUnreturnedCandidate
      ? (selected.at(-1)?.contentKey ?? "")
      : (advanceCursor ?? selected.at(-1)?.contentKey ?? "");
  }
  return {
    activeReleaseId,
    continueCursor,
    isDone,
    page: selected.map(({ entry }) => entry),
  };
}

/** Reconciles source and exact material ownership for one partner API page. */
export const readMaterialApiPage = Effect.fn(
  "contentRelease.readMaterialApiPage"
)(function* (ctx: QueryCtx, rawInput: MaterialApiPageInput) {
  const input = yield* validatePageInput(rawInput);
  const catalog = yield* loadMaterialCatalogOwner(ctx);
  const activeReleaseId = catalog.active?.releaseId ?? null;
  if (catalog.active && catalog.familyManaged) {
    return yield* readFamilyPage(ctx, input, catalog.active.releaseId);
  }
  const exact =
    catalog.active && catalog.ready
      ? yield* readExactMaterialSnapshot(ctx, catalog.active, input.locale)
      : { materials: [], owners: [] };
  const claimed = new Set(exact.owners.map(({ contentKey }) => contentKey));
  const source = yield* readSourceCandidates(ctx, input, claimed);
  const sourceBoundary = source.exhausted ? null : source.advanceCursor;
  const exactCandidates = exact.materials
    .filter(
      ({ row }) =>
        matchesPrefix(row.contentKey, input.prefix) &&
        (input.cursor === null || row.contentKey > input.cursor) &&
        (sourceBoundary === null || row.contentKey <= sourceBoundary)
    )
    .map(publishedCandidate);
  return buildPage(
    activeReleaseId,
    input.limit,
    [...source.candidates, ...exactCandidates],
    source.exhausted,
    source.advanceCursor
  );
});

/** Resolves graph lookup ownership and the active publication timestamp. */
export const readMaterialApiRoute = Effect.fn(
  "contentRelease.readMaterialApiRoute"
)(function* (ctx: QueryCtx, input: MaterialLookupInput) {
  const lookup = yield* lookupMaterial(ctx, input);
  if (!lookup.managed) {
    return { ...lookup, syncedAt: null };
  }
  const catalog = yield* loadMaterialCatalogOwner(ctx);
  if (!catalog.active || lookup.activeReleaseId !== catalog.active.releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Material API lookup changed active release during one transaction."
    );
  }
  return {
    ...lookup,
    syncedAt:
      catalog.active.release.completedAt ?? catalog.active.release.updatedAt,
  };
});
