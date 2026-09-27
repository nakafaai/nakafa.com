import { assert, describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import type { ContentStateDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { Effect, Option } from "effect";

describe("active search publication ownership", () => {
  it.effect(
    "exposes the active search generation only after all identity fields synchronize",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            expect(yield* loadSearchOwner()).toBeNull();
            const ctx = yield* MutationCtx;
            yield* Effect.promise(() => insertRuntimeArticles(ctx, 1));
            const identity = {
              searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
              searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
              searchSequence: TEST_RUNTIME_RELEASE.sequence,
            };
            const patches: readonly {
              [Key in keyof typeof identity]?: ContentStateDoc[Key] | undefined;
            }[] = [
              { searchManifestHash: undefined },
              { searchReleaseId: "previous-release" },
              { searchSequence: TEST_RUNTIME_RELEASE.sequence - 1 },
            ];
            const state = yield* reader
              .table("contentState")
              .index("by_key", (q) => q.eq("key", "primary"))
              .first();
            assert(Option.isSome(state));
            for (const patch of patches) {
              yield* writer
                .table("contentState")
                .patch(state.value._id, { ...identity, ...patch });
              expect(yield* loadSearchOwner().pipe(Effect.flip)).toMatchObject({
                _tag: "ReleaseError",
                code: "CONTENT_RELEASE_STATE",
                message: `Search for active release ${TEST_RUNTIME_RELEASE.releaseId} is still synchronizing.`,
              });
            }
            yield* writer
              .table("contentState")
              .patch(state.value._id, identity);
            expect(yield* loadSearchOwner()).toMatchObject({
              families: ContentFamilySchema.literals,
              manifestHash: TEST_RUNTIME_RELEASE.manifestHash,
              releaseId: TEST_RUNTIME_RELEASE.releaseId,
              sequence: TEST_RUNTIME_RELEASE.sequence,
            });
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
