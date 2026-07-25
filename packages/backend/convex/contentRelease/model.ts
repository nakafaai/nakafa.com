import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type {
  localeValidator,
  releaseRoleValidator,
} from "@repo/backend/convex/contentRelease/spec";
import {
  COMPACTION_PAGE_BYTES,
  RELEASE_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type ContentLocale = Infer<typeof localeValidator>;
type ReleaseRole = Infer<typeof releaseRoleValidator>;

/** Reads the singleton publication identity through its exact index. */
export const loadState = Effect.fn("contentRelease.loadState")(function* (
  ctx: ReadCtx
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentState")
      .withIndex("by_key", (query) => query.eq("key", "primary"))
      .unique()
  );
});

/** Creates the empty publication identity exactly once. */
export const ensureState = Effect.fn("contentRelease.ensureState")(function* (
  ctx: MutationCtx
) {
  const existing = yield* loadState(ctx);
  if (existing) {
    return existing;
  }
  const now = Date.now();
  const id = yield* Effect.promise(() =>
    ctx.db.insert("contentState", {
      key: "primary",
      nextSequence: 1,
      updatedAt: now,
    })
  );
  const created = yield* Effect.promise(() => ctx.db.get("contentState", id));
  if (!created) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Content publication state was not created."
    );
  }
  return created;
});

/** Reads one release by its signed identity or fails visibly. */
export const loadRelease = Effect.fn("contentRelease.loadRelease")(function* (
  ctx: ReadCtx,
  releaseId: string
) {
  const release = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
      .unique()
  );
  if (!release) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Content release ${releaseId} does not exist.`
    );
  }
  return release;
});

/** Requires one release to own its exact candidate or recovery slot. */
export const loadStaged = Effect.fn("contentRelease.loadStaged")(function* (
  ctx: ReadCtx,
  releaseId: string
) {
  const state = yield* loadState(ctx);
  const release = yield* loadRelease(ctx, releaseId);
  if (!state) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} has no publication state.`
    );
  }
  const slotReleaseId =
    release.role === "candidate"
      ? state.candidateReleaseId
      : state.recoveryReleaseId;
  const slotSequence =
    release.role === "candidate"
      ? state.candidateSequence
      : state.recoverySequence;
  if (slotReleaseId !== releaseId || slotSequence !== release.sequence) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} does not own its ${release.role} slot.`
    );
  }
  return { release, state };
});

/** Resolves the newest immutable content version at or before a sequence. */
export const loadVersion = Effect.fn("contentRelease.loadVersion")(function* (
  ctx: ReadCtx,
  contentKey: string,
  locale: ContentLocale,
  sequence: number
) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("contentHeads")
      .withIndex("by_contentKey_and_locale_and_sequence", (query) =>
        query
          .eq("contentKey", contentKey)
          .eq("locale", locale)
          .lte("sequence", sequence)
      )
      .order("desc")
      .take(2)
  );
  if (rows[0] && rows[1]?.sequence === rows[0].sequence) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content ${contentKey}/${locale} has duplicate versions at sequence ${rows[0].sequence}.`
    );
  }
  return rows[0] ?? null;
});

/** Reads one immutable content version at its exact release sequence. */
export const loadExactVersion = Effect.fn("contentRelease.loadExactVersion")(
  function* (
    ctx: ReadCtx,
    contentKey: string,
    locale: ContentLocale,
    sequence: number
  ) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentHeads")
        .withIndex("by_contentKey_and_locale_and_sequence", (query) =>
          query
            .eq("contentKey", contentKey)
            .eq("locale", locale)
            .eq("sequence", sequence)
        )
        .unique()
    );
  }
);

/** Resolves the newest immutable route binding before access enforcement. */
export const loadRouteBinding = Effect.fn("contentRelease.loadRouteBinding")(
  function* (
    ctx: ReadCtx,
    locale: ContentLocale,
    publicPath: string,
    sequence: number
  ) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_locale_and_publicPath_and_sequence_and_index", (query) =>
          query
            .eq("locale", locale)
            .eq("publicPath", publicPath)
            .lte("sequence", sequence)
        )
        .order("desc")
        .take(2)
    );
    if (rows[0] && rows[1]?.sequence === rows[0].sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${locale}/${publicPath} has duplicate bindings at sequence ${rows[0].sequence}.`
      );
    }
    return rows[0] ?? null;
  }
);

/** Reads one ordered release item through its exact index. */
export const loadItem = Effect.fn("contentRelease.loadItem")(function* (
  ctx: ReadCtx,
  releaseId: string,
  index: number
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId).eq("index", index)
      )
      .unique()
  );
});

/** Reads one byte- and row-bounded page of changed release identities. */
export const loadReleaseItems = Effect.fn("contentRelease.loadReleaseItems")(
  function* (ctx: ReadCtx, releaseId: string, afterIndex: number) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_index", (index) =>
          index.eq("releaseId", releaseId).gt("index", afterIndex)
        )
        .paginate({
          cursor: null,
          maximumBytesRead: COMPACTION_PAGE_BYTES,
          maximumRowsRead: RELEASE_PAGE_LIMIT,
          numItems: RELEASE_PAGE_LIMIT,
        })
    );
  }
);

/** Reads one item through its stable locale-specific content identity. */
export const loadIdentityItem = Effect.fn("contentRelease.loadIdentityItem")(
  function* (
    ctx: ReadCtx,
    releaseId: string,
    contentKey: string,
    locale: ContentLocale
  ) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_contentKey_and_locale", (query) =>
          query
            .eq("releaseId", releaseId)
            .eq("contentKey", contentKey)
            .eq("locale", locale)
        )
        .unique()
    );
  }
);

/** Selects the immutable snapshot sequence extended by one staged role. */
export function stagedBaseSequence(
  role: ReleaseRole,
  state: Doc<"contentState">
) {
  return role === "candidate" ? state.activeSequence : state.candidateSequence;
}

/** Checks whether a release owns the exact singleton role identity. */
export function ownsRole(
  state: Doc<"contentState">,
  role: ReleaseRole,
  release: Doc<"contentReleases">
) {
  if (role === "candidate") {
    return (
      state.candidateReleaseId === release.releaseId &&
      state.candidateSequence === release.sequence
    );
  }
  return (
    state.recoveryReleaseId === release.releaseId &&
    state.recoverySequence === release.sequence
  );
}
