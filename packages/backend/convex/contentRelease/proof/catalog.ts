import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolveContentHead } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadStaged,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/convex/contentRelease/proof/budget";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import {
  artifactLocaleValidator,
  contentHeadValidator,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const catalogCursorValidator = v.object({
  artifactLocale: artifactLocaleValidator,
  contentKey: v.string(),
});
const catalogPageValidator = v.object({
  done: v.boolean(),
  heads: v.array(contentHeadValidator),
  nextCursor: v.union(catalogCursorValidator, v.null()),
});

export type CatalogCursor = Infer<typeof catalogCursorValidator>;

export interface CatalogPage {
  readonly done: boolean;
  readonly heads: readonly ContentHead[];
  readonly nextCursor: CatalogCursor | null;
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
export const catalogRelease = Effect.fn("contentRelease.catalogRelease")(
  function* (ctx: QueryCtx, releaseId: string) {
    const { release, state } = yield* loadStaged(ctx, releaseId);
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
  }
);

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
            .withIndex("by_contentKey_and_artifactLocale", (query) =>
              query
                .eq("contentKey", cursor.contentKey)
                .gt("artifactLocale", cursor.artifactLocale)
            )
            .order("asc")
            .take(limit)
        );
  const remaining = limit - sameKey.length;
  const laterKeys = yield* Effect.promise(() => {
    if (cursor === null) {
      return ctx.db
        .query("contentKeys")
        .withIndex("by_contentKey_and_artifactLocale")
        .order("asc")
        .take(remaining);
    }
    return ctx.db
      .query("contentKeys")
      .withIndex("by_contentKey_and_artifactLocale", (query) =>
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
      key.contentKey,
      key.artifactLocale,
      release.sequence
    ).pipe(Effect.provide(convexPublicationLayer(ctx)));
    if (head) {
      // 128 schema-bounded heads fit below 652 KiB, within the proof ceiling.
      heads.push(head);
    }
    nextCursor = {
      artifactLocale: key.artifactLocale,
      contentKey: key.contentKey,
    };
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
