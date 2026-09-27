import { assert, describe, expect, it } from "@effect/vitest";
import type { ContentIndexDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { resolveSearchProjection } from "@repo/backend/confect/contentRelease/search/verify";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  insertTestPage,
  TEST_PAGE_KEY,
  TEST_PAGE_PATH,
} from "@repo/backend/test/content/page";
import { testTextHash } from "@repo/backend/test/content/release";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { Effect, Option } from "effect";

describe("search result publication integrity", () => {
  it.effect(
    "requires every indexed hit to match its active slot and immutable publication",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const ctx = yield* MutationCtx;
            const projection = testArticleProjection(0);
            yield* Effect.promise(() => insertRuntimeArticles(ctx, 1));
            yield* Effect.promise(() =>
              insertRuntimeIndex(ctx, projection.contentKey)
            );
            const state = yield* reader
              .table("contentState")
              .index("by_key", (q) => q.eq("key", "primary"))
              .first();
            assert(Option.isSome(state));
            yield* writer.table("contentState").patch(state.value._id, {
              searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
              searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
              searchSequence: TEST_RUNTIME_RELEASE.sequence,
            });
            const owner = yield* loadSearchOwner();
            assert(owner);
            const hits = yield* reader
              .table("contentIndex")
              .index("by_creation_time")
              .collect();
            assert.strictEqual(hits.length, 1);
            const original = hits[0];
            assert(original);
            expect(
              yield* resolveSearchProjection(original, owner)
            ).toMatchObject({
              contentKey: projection.contentKey,
              publicPath: projection.publicPath,
              projection,
            });
            expect(
              yield* resolveSearchProjection(original, {
                ...owner,
                families: [],
              }).pipe(Effect.flip)
            ).toMatchObject({
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_INTEGRITY",
            });
            const identity = {
              appLocale: original.appLocale,
              contentKey: original.contentKey,
              family: original.family,
              projectionHash: original.projectionHash,
              publicPath: original.publicPath,
              releaseId: original.releaseId,
              sequence: original.sequence,
              slot: original.slot,
            };
            const patches: readonly Partial<ContentIndexDoc>[] = [
              { slot: "green" },
              { family: "material" },
              { appLocale: "id" },
              { projectionHash: `sha256:${"f".repeat(64)}` },
              { publicPath: "articles/politics/other-route" },
              { releaseId: "different-release" },
              { sequence: original.sequence + 1 },
            ];
            for (const patch of patches) {
              yield* writer
                .table("contentIndex")
                .patch(original._id, { ...identity, ...patch });
              const row = yield* reader.table("contentIndex").get(original._id);
              expect(
                yield* resolveSearchProjection(row, owner).pipe(Effect.flip)
              ).toMatchObject({
                _tag: "ReleaseError",
                code: "CONTENT_RELEASE_INTEGRITY",
                message: `Active search entry ${projection.contentKey}/${patch.appLocale ?? original.appLocale} is stale.`,
              });
            }
            const page = yield* Effect.promise(() =>
              insertTestPage(ctx, "en", "terms-of-service", TEST_PAGE_PATH)
            );
            yield* writer.table("contentIndex").patch(original._id, {
              ...identity,
              contentKey: TEST_PAGE_KEY,
              projectionHash: testTextHash(page),
              publicPath: TEST_PAGE_PATH,
            });
            const row = yield* reader.table("contentIndex").get(original._id);
            expect(
              yield* resolveSearchProjection(row, owner).pipe(Effect.flip)
            ).toMatchObject({
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_INTEGRITY",
              message: `Active search entry ${TEST_PAGE_KEY}/en is stale.`,
            });
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
