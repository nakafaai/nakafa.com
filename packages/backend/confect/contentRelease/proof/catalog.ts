import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadStaged,
} from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/confect/contentRelease/proof/budget";
import type { catalogCursorValidator } from "@repo/backend/confect/contentRelease/proof/catalog.spec";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/confect/contentRelease/receipt";
import {
  type contentHeadValidator,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { resolveContentHead } from "@repo/backend/content/publication/projection";
import { Effect, type Schema } from "effect";
export type CatalogCursor = Schema.Schema.Type<typeof catalogCursorValidator>;
export interface CatalogPage {
  readonly done: boolean;
  readonly heads: readonly ContentHead[];
  readonly nextCursor: CatalogCursor | null;
}

/** Proves one staged release still extends its exact durable base slot. */
export const validateBase = Effect.fn("contentRelease.validateCatalogBase")(
  function* (release: Docs["contentReleases"], state: Docs["contentState"]) {
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
    const base = yield* loadRelease(baseId);
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
  }
);

/** Loads one staged release after validating its frozen base identity. */
export const catalogRelease = Effect.fn("contentRelease.catalogRelease")(
  function* (releaseId: string) {
    const { release, state } = yield* loadStaged(releaseId);
    if (release.status !== "verifying" && release.status !== "verified") {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} cannot expose a result catalog.`
      );
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    yield* stagedEvidence(release, signed);
    yield* validateBase(release, state);
    return release;
  }
);

/** Loads the next bounded permanent identities after one logical cursor. */
export const loadCatalogKeys = Effect.fn("contentRelease.loadCatalogKeys")(
  function* (cursor: CatalogCursor | null) {
    const database = yield* DatabaseReader;
    const limit = PROOF_PAGE_LIMIT + 1;
    const sameKey =
      cursor === null
        ? []
        : yield* database
            .table("contentKeys")
            .index(
              "by_contentKey_and_artifactLocale",
              (query) =>
                query
                  .eq("contentKey", cursor.contentKey)
                  .gt("artifactLocale", cursor.artifactLocale),
              "asc"
            )
            .take(limit);
    const remaining = limit - sameKey.length;
    const laterKeys = yield* database
      .table("contentKeys")
      .index("by_contentKey_and_artifactLocale", (query) =>
        cursor === null ? query : query.gt("contentKey", cursor.contentKey)
      )
      .take(remaining);
    return [...sameKey, ...laterKeys];
  },
  Effect.orDie
);

/** Reads one canonical result-catalog page from a frozen release sequence. */
export const pageProgram = Effect.fn("contentRelease.resultCatalogPage")(
  function* (releaseId: string, cursor: CatalogCursor | null) {
    const ctx = yield* QueryCtxService;
    const release = yield* catalogRelease(releaseId);
    const stored = yield* loadCatalogKeys(cursor);
    const keys = stored.slice(0, PROOF_PAGE_LIMIT);
    const heads: (ContentHead &
      Schema.Schema.Type<typeof contentHeadValidator>)[] = [];
    let nextCursor = cursor;
    let processed = 0;
    for (const key of keys) {
      const head = yield* resolveContentHead(
        key.contentKey,
        key.artifactLocale,
        release.sequence
      ).pipe(Effect.provide(publicationLayer));
      if (head) {
        // 128 schema-bounded heads fit below 652 KiB, within the proof ceiling.
        const { publicPath, ...fields } = head;
        heads.push({
          ...fields,
          ...(publicPath === undefined
            ? {}
            : {
                publicPath,
              }),
        });
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
  }
);
