import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { validateReleaseCursor } from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { validateProjectionPage } from "@repo/backend/convex/contentRelease/paging";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import {
  contentFamilyValidator,
  localeValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const SEARCH_TERM_LIMIT = 16;
const SEARCH_TERM_BYTES = 32;
const searchSeparator = /[\s\p{P}\p{S}]+/u;

const projectionValidator = v.object({
  contentKey: v.string(),
  family: contentFamilyValidator,
  locale: localeValidator,
  projectionHash: v.string(),
  projectionJson: v.string(),
  publicPath: v.string(),
  releaseId: v.string(),
  rendererDomain: rendererDomainValidator,
  sequence: v.number(),
  sourcePath: v.string(),
});

const searchValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  result: paginationResultValidator(projectionValidator),
});

type ProjectionFamily = Infer<typeof contentFamilyValidator>;
type ProjectionLocale = Infer<typeof localeValidator>;

/** Decodes one query into the documented Convex full-text term budget. */
const validateSearchQuery = Effect.fn("contentRelease.validateSearchQuery")(
  function* (source: string) {
    const queryText = source.trim();
    const terms = queryText
      .split(searchSeparator)
      .filter((term) => term.length > 0);
    if (
      terms.length === 0 ||
      terms.length > SEARCH_TERM_LIMIT ||
      terms.some(
        (term) => new TextEncoder().encode(term).byteLength > SEARCH_TERM_BYTES
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Search accepts 1 to ${SEARCH_TERM_LIMIT} terms of at most ${SEARCH_TERM_BYTES} bytes.`
      );
    }
    return queryText;
  }
);

/** Loads active ownership only when its public search model is fully synced. */
export const loadSearchOwner = Effect.fn("contentRelease.loadSearchOwner")(
  function* (ctx: QueryCtx) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return null;
    }
    const { state } = active;
    if (
      state.searchManifestHash !== active.manifestHash ||
      state.searchReleaseId !== active.releaseId ||
      state.searchSequence !== active.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Search for active release ${active.releaseId} is still synchronizing.`
      );
    }
    const families = yield* loadReleaseFamilies(active.release);
    const readyFamilies = families.result.filter((family) => {
      if (family === "article") {
        return (
          state.articleManifestHash === active.manifestHash &&
          state.articleReleaseId === active.releaseId &&
          state.articleSequence === active.sequence
        );
      }
      if (family === "material") {
        return (
          state.materialManifestHash === active.manifestHash &&
          state.materialReleaseId === active.releaseId &&
          state.materialSequence === active.sequence
        );
      }
      return true;
    });
    return {
      families: families.result,
      manifestHash: active.manifestHash,
      readyFamilies,
      releaseId: active.releaseId,
      sequence: active.sequence,
    };
  }
);

/** Searches one relevance page from the active-only public search model. */
const searchPage = Effect.fn("contentRelease.searchProjectionPage")(function* (
  ctx: QueryCtx,
  family: ProjectionFamily,
  locale: ProjectionLocale,
  source: string,
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  paginationOpts: Parameters<typeof validateProjectionPage>[0]
) {
  if (paginationOpts.maximumBytesRead !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "Search pages use the search index's server-owned read budget."
    );
  }
  const [queryText, options, active] = yield* Effect.all([
    validateSearchQuery(source),
    validateProjectionPage(paginationOpts),
    loadSearchOwner(ctx),
  ]);
  if (options.endCursor !== undefined && options.endCursor !== null) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "Search pages accept only their server-owned continuation cursor."
    );
  }
  yield* validateReleaseCursor(
    options.cursor,
    expectedManifestHash,
    expectedReleaseId,
    active
  );
  if (!active) {
    return {
      activeManifestHash: null,
      activeReleaseId: null,
      result: {
        continueCursor: "",
        isDone: true,
        page: [],
      },
    };
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentIndex")
      .withSearchIndex("search_text", (index) =>
        index
          .search("text", queryText)
          .eq("family", family)
          .eq("locale", locale)
      )
      .paginate({
        cursor: options.cursor,
        numItems: options.numItems,
      })
  );
  const page = yield* Effect.forEach(stored.page, (hit) =>
    resolveSearchProjection(ctx, hit, active)
  );
  return {
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    result: { ...stored, page },
  };
});

/** Searches only public projections selected by one release-bound cursor. */
export const find = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    family: contentFamilyValidator,
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
    query: v.string(),
  },
  returns: searchValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      searchPage(
        ctx,
        args.family,
        args.locale,
        args.query,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});
