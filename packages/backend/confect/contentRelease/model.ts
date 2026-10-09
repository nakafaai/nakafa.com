import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { INITIAL_MODEL_SLOT } from "@repo/backend/confect/contentRelease/models/slot";
import type {
  appLocaleValidator,
  artifactLocaleValidator,
  releaseRoleValidator,
} from "@repo/backend/confect/contentRelease/spec";
import {
  COMPACTION_PAGE_BYTES,
  RELEASE_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { Clock, Effect } from "effect";

type AppLocale = typeof appLocaleValidator.Type;
type ArtifactLocale = typeof artifactLocaleValidator.Type;
type ReleaseRole = typeof releaseRoleValidator.Type;

/** Reads the singleton publication identity through its exact index. */
export const loadState = Effect.fn("contentRelease.loadState")(function* () {
  const database = yield* DatabaseReader;
  return yield* database
    .table("contentState")
    .get("by_key", "primary")
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Creates the empty publication identity exactly once. */
export const ensureState = Effect.fn("contentRelease.ensureState")(
  function* () {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const existing = yield* loadState();
    if (existing) {
      return existing;
    }
    const now = yield* Clock.currentTimeMillis;
    const id = yield* writer
      .table("contentState")
      .insert({
        articleSlot: INITIAL_MODEL_SLOT,
        key: "primary",
        materialSlot: INITIAL_MODEL_SLOT,
        nextSequence: 1,
        searchSlot: INITIAL_MODEL_SLOT,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return yield* database.table("contentState").get(id).pipe(Effect.orDie);
  }
);

/** Reads one release by its signed identity or fails visibly. */
export const loadRelease = Effect.fn("contentRelease.loadRelease")(function* (
  releaseId: string
) {
  return yield* (yield* DatabaseReader)
    .table("contentReleases")
    .get("by_releaseId", releaseId)
    .pipe(
      Effect.catchTags({
        GetByIndexFailure: () =>
          releaseFail(
            "CONTENT_RELEASE_MISSING",
            `Content release ${releaseId} does not exist.`
          ),
        DocumentDecodeError: () =>
          Effect.fail(
            ReleaseError.make({
              code: "CONTENT_RELEASE_INTEGRITY",
              message: `Content release ${releaseId} does not match its stored contract.`,
            })
          ),
      })
    );
});

/** Requires one release to own its exact candidate or recovery slot. */
export const loadStaged = Effect.fn("contentRelease.loadStaged")(function* (
  releaseId: string
) {
  const state = yield* loadState();
  const release = yield* loadRelease(releaseId);
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
  return {
    release,
    state,
  };
});

/** Resolves the newest immutable content version at or before a sequence. */
export const loadVersion = Effect.fn("contentRelease.loadVersion")(function* (
  contentKey: string,
  artifactLocale: ArtifactLocale,
  sequence: number
) {
  const database = yield* DatabaseReader;
  const rows = yield* database
    .table("contentHeads")
    .index(
      "by_contentKey_and_artifactLocale_and_sequence",
      (query) =>
        query
          .eq("contentKey", contentKey)
          .eq("artifactLocale", artifactLocale)
          .lte("sequence", sequence),
      "desc"
    )
    .take(2)
    .pipe(Effect.orDie);
  if (rows[0] && rows[1]?.sequence === rows[0].sequence) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content ${contentKey}/${artifactLocale} has duplicate versions at sequence ${rows[0].sequence}.`
    );
  }
  return rows[0] ?? null;
});

/** Reads one immutable content version at its exact release sequence. */
export const loadExactVersion = Effect.fn("contentRelease.loadExactVersion")(
  function* (
    contentKey: string,
    artifactLocale: ArtifactLocale,
    sequence: number
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("contentHeads")
      .get(
        "by_contentKey_and_artifactLocale_and_sequence",
        contentKey,
        artifactLocale,
        sequence
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/** Resolves the newest immutable route binding before access enforcement. */
export const loadRouteBinding = Effect.fn("contentRelease.loadRouteBinding")(
  function* (appLocale: AppLocale, publicPath: string, sequence: number) {
    const database = yield* DatabaseReader;
    const rows = yield* database
      .table("contentBindings")
      .index(
        "by_appLocale_and_publicPath_and_sequence_and_index",
        (query) =>
          query
            .eq("appLocale", appLocale)
            .eq("publicPath", publicPath)
            .lte("sequence", sequence),
        "desc"
      )
      .take(2)
      .pipe(Effect.orDie);
    if (rows[0] && rows[1]?.sequence === rows[0].sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${appLocale}/${publicPath} has duplicate bindings at sequence ${rows[0].sequence}.`
      );
    }
    return rows[0] ?? null;
  }
);

/** Reads one ordered release item through its exact index. */
export const loadItem = Effect.fn("contentRelease.loadItem")(function* (
  releaseId: string,
  index: number
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("contentItems")
    .get("by_releaseId_and_index", releaseId, index)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Reads one byte- and row-bounded page of changed release identities. */
export const loadReleaseItems = Effect.fn("contentRelease.loadReleaseItems")(
  function* (releaseId: string, afterIndex: number) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("contentItems")
      .index("by_releaseId_and_index", (index) =>
        index.eq("releaseId", releaseId).gt("index", afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: COMPACTION_PAGE_BYTES,
        maximumRowsRead: RELEASE_PAGE_LIMIT,
        numItems: RELEASE_PAGE_LIMIT,
      })
      .pipe(Effect.orDie);
  }
);

/** Reads one item through its stable compiled-content identity. */
export const loadIdentityItem = Effect.fn("contentRelease.loadIdentityItem")(
  function* (
    releaseId: string,
    contentKey: string,
    artifactLocale: ArtifactLocale
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("contentItems")
      .get(
        "by_releaseId_and_contentKey_and_artifactLocale",
        releaseId,
        contentKey,
        artifactLocale
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/** Selects the immutable snapshot sequence extended by one staged role. */
export function stagedBaseSequence(
  role: ReleaseRole,
  state: Docs["contentState"]
) {
  return role === "candidate" ? state.activeSequence : state.candidateSequence;
}

/** Checks whether a release owns the exact singleton role identity. */
export function ownsRole(
  state: Docs["contentState"],
  role: ReleaseRole,
  release: Docs["contentReleases"]
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
