import { familyForProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { resolveContentHead } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadRouteBinding,
  loadStaged,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeProjectionJson,
  decodeReleaseJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/convex/contentRelease/proof/budget";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import {
  contentHeadValidator,
  localeValidator,
  PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getConvexSize, type Infer, v } from "convex/values";
import { Effect } from "effect";

const catalogCursorValidator = v.object({
  contentKey: v.string(),
  locale: localeValidator,
});
const catalogPageValidator = v.object({
  done: v.boolean(),
  heads: v.array(contentHeadValidator),
  nextCursor: v.union(catalogCursorValidator, v.null()),
});
const routeCatalogValidator = v.object({
  checked: v.number(),
  done: v.boolean(),
  nextCursor: v.union(v.string(), v.null()),
});

export type CatalogCursor = Infer<typeof catalogCursorValidator>;

export interface CatalogPage {
  readonly done: boolean;
  readonly heads: readonly ContentHead[];
  readonly nextCursor: CatalogCursor | null;
}

export interface RouteCatalogPage {
  readonly checked: number;
  readonly done: boolean;
  readonly nextCursor: null | string;
}

/** Proves one staged release still extends its exact durable base slot. */
const validateBase = Effect.fn("contentRelease.validateCatalogBase")(function* (
  ctx: QueryCtx,
  release: Doc<"contentReleases">,
  state: Doc<"contentState">
) {
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const baseId = signed.manifest.baseReleaseId;
  const baseHash = signed.manifest.baseManifestHash;
  const stateId =
    release.role === "candidate"
      ? state.activeReleaseId
      : state.candidateReleaseId;
  const stateHash =
    release.role === "candidate"
      ? state.activeManifestHash
      : state.candidateManifestHash;
  const stateSequence =
    release.role === "candidate"
      ? state.activeSequence
      : state.candidateSequence;
  if ((stateId ?? null) !== baseId || (stateHash ?? null) !== baseHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${release.releaseId} lost its result-catalog base.`
    );
  }
  if (baseId === null) {
    if (stateSequence !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} has a nonempty genesis sequence.`
      );
    }
    return;
  }
  if (baseHash === null || stateSequence === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${release.releaseId} has an incomplete base identity.`
    );
  }
  const base = yield* loadRelease(ctx, baseId);
  const baseSigned = yield* decodeReleaseJson(base.releaseJson);
  if (
    base.sequence !== stateSequence ||
    baseSigned.manifestHash !== baseHash ||
    (release.role === "candidate"
      ? base.status !== "completed"
      : base.role !== "candidate" || base.status !== "verified")
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${release.releaseId} has an invalid catalog base.`
    );
  }
  if (release.role === "candidate") {
    yield* completedReceipt(base, baseSigned);
    return;
  }
  yield* stagedEvidence(base, baseSigned);
});

/** Loads one staged release after validating its frozen base identity. */
const catalogRelease = Effect.fn("contentRelease.catalogRelease")(function* (
  ctx: QueryCtx,
  releaseId: string
) {
  const { release, state } = yield* loadStaged(ctx, releaseId);
  if (!state) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} lost publication state.`
    );
  }
  if (release.status !== "verifying" && release.status !== "verified") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} cannot expose a result catalog.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  yield* stagedEvidence(release, signed);
  yield* validateBase(ctx, release, state);
  return release;
});

/** Loads the next bounded permanent identities after one logical cursor. */
const loadCatalogKeys = Effect.fn("contentRelease.loadCatalogKeys")(function* (
  ctx: QueryCtx,
  cursor: CatalogCursor | null
) {
  const limit = PROOF_PAGE_LIMIT + 1;
  const sameKey =
    cursor === null
      ? []
      : yield* Effect.promise(() =>
          ctx.db
            .query("contentKeys")
            .withIndex("by_contentKey_and_locale", (query) =>
              query
                .eq("contentKey", cursor.contentKey)
                .gt("locale", cursor.locale)
            )
            .order("asc")
            .take(limit)
        );
  if (sameKey.length === limit) {
    return sameKey;
  }
  const remaining = limit - sameKey.length;
  const laterKeys = yield* Effect.promise(() => {
    if (cursor === null) {
      return ctx.db
        .query("contentKeys")
        .withIndex("by_contentKey_and_locale")
        .order("asc")
        .take(remaining);
    }
    return ctx.db
      .query("contentKeys")
      .withIndex("by_contentKey_and_locale", (query) =>
        query.gt("contentKey", cursor.contentKey)
      )
      .order("asc")
      .take(remaining);
  });
  return [...sameKey, ...laterKeys];
});

/** Reads one canonical result-catalog page from a frozen release sequence. */
const pageProgram = Effect.fn("contentRelease.resultCatalogPage")(function* (
  ctx: QueryCtx,
  releaseId: string,
  cursor: CatalogCursor | null
) {
  const release = yield* catalogRelease(ctx, releaseId);
  const stored = yield* loadCatalogKeys(ctx, cursor);
  const keys = stored.slice(0, PROOF_PAGE_LIMIT);
  const heads: ContentHead[] = [];
  let nextCursor = cursor;
  let processed = 0;
  for (const key of keys) {
    const head = yield* resolveContentHead(
      ctx,
      key.contentKey,
      key.locale,
      release.sequence
    );
    if (head) {
      const candidate = {
        done: false,
        heads: [...heads, head],
        nextCursor: {
          contentKey: key.contentKey,
          locale: key.locale,
        },
      };
      if (getConvexSize(candidate) > PROOF_PAGE_BYTES) {
        if (heads.length === 0) {
          return yield* releaseFail(
            "CONTENT_RELEASE_LIMIT",
            `Content head ${key.contentKey}/${key.locale} exceeds the proof page ceiling.`
          );
        }
        break;
      }
      heads.push(head);
    }
    nextCursor = { contentKey: key.contentKey, locale: key.locale };
    processed += 1;
    const metrics = yield* Effect.promise(() =>
      ctx.meta.getTransactionMetrics()
    );
    if (!hasProofTransactionHeadroom(metrics)) {
      break;
    }
  }
  const done = processed === keys.length && stored.length <= PROOF_PAGE_LIMIT;
  return {
    done,
    heads,
    nextCursor: done ? null : nextCursor,
  } satisfies CatalogPage;
});

/** Validates one bounded active-route directory page at a frozen sequence. */
const routeProgram = Effect.fn("contentRelease.routeCatalogPage")(function* (
  ctx: QueryCtx,
  releaseId: string,
  cursor: null | string
) {
  const release = yield* catalogRelease(ctx, releaseId);
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentPaths")
      .withIndex("by_createdSequence_and_locale_and_publicPath", (query) =>
        query.lte("createdSequence", release.sequence)
      )
      .order("asc")
      .paginate({
        cursor,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: ROUTE_CATALOG_PAGE_LIMIT,
        numItems: ROUTE_CATALOG_PAGE_LIMIT,
      })
  );
  for (const path of stored.page) {
    const binding = yield* loadRouteBinding(
      ctx,
      path.locale,
      path.publicPath,
      release.sequence
    );
    if (!binding || binding.operation === "delete") {
      continue;
    }
    if (!binding.contentKey) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${path.locale}/${path.publicPath} lost its content key.`
      );
    }
    const head = yield* loadVersion(
      ctx,
      binding.contentKey,
      path.locale,
      release.sequence
    );
    if (head?.operation !== "upsert") {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${path.locale}/${path.publicPath} targets missing content.`
      );
    }
    if (!head.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${path.locale}/${path.publicPath} lost its projection.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    if (
      projection.contentKey !== binding.contentKey ||
      familyForProjection(projection) !== head.family ||
      projection.locale !== path.locale ||
      projection.kind === "question-body" ||
      projection.publicPath !== path.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${path.locale}/${path.publicPath} disagrees with its projection.`
      );
    }
    if (
      head.sequence === binding.sequence &&
      head.releaseId !== binding.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${path.locale}/${path.publicPath} disagrees at one sequence.`
      );
    }
  }
  return {
    checked: stored.page.length,
    done: stored.isDone,
    nextCursor: stored.isDone ? null : stored.continueCursor,
  } satisfies RouteCatalogPage;
});

/** Returns one bounded effective result-catalog page for Node proof replay. */
export const page = internalQuery({
  args: {
    cursor: v.union(catalogCursorValidator, v.null()),
    releaseId: v.string(),
  },
  returns: catalogPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(pageProgram(ctx, args.releaseId, args.cursor)),
});

/** Returns one bounded route catalog page after validating every owner. */
export const routes = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), releaseId: v.string() },
  returns: routeCatalogValidator,
  handler: (ctx, args) =>
    runConvexProgram(routeProgram(ctx, args.releaseId, args.cursor)),
});
