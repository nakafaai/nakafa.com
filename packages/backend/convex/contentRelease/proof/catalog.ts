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
  decodeProjectionWireJson,
  decodeReleaseJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import {
  contentHeadValidator,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const catalogPageValidator = v.object({
  done: v.boolean(),
  heads: v.array(contentHeadValidator),
  nextCursor: v.union(v.string(), v.null()),
});
const routeCatalogValidator = v.object({
  checked: v.number(),
  done: v.boolean(),
  nextCursor: v.union(v.string(), v.null()),
});

export interface CatalogPage {
  readonly done: boolean;
  readonly heads: readonly ContentHead[];
  readonly nextCursor: null | string;
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

/** Reads one canonical result-catalog page from a frozen release sequence. */
const pageProgram = Effect.fn("contentRelease.resultCatalogPage")(function* (
  ctx: QueryCtx,
  releaseId: string,
  cursor: null | string
) {
  const release = yield* catalogRelease(ctx, releaseId);
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentKeys")
      .withIndex("by_contentKey_and_locale")
      .order("asc")
      .paginate({
        cursor,
        maximumRowsRead: PROOF_PAGE_LIMIT,
        numItems: PROOF_PAGE_LIMIT,
      })
  );
  const heads: ContentHead[] = [];
  for (const key of stored.page) {
    const head = yield* resolveContentHead(
      ctx,
      key.contentKey,
      key.locale,
      release.sequence
    );
    if (head) {
      heads.push(head);
    }
  }
  return {
    done: stored.isDone,
    heads,
    nextCursor: stored.isDone ? null : stored.continueCursor,
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
        maximumRowsRead: PROOF_PAGE_LIMIT,
        numItems: PROOF_PAGE_LIMIT,
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
    const projection = yield* decodeProjectionWireJson(head.projectionJson);
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
  args: { cursor: v.union(v.string(), v.null()), releaseId: v.string() },
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
