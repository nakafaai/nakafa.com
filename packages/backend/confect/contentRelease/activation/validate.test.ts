import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  validateActivationRenderer,
  validateCandidate,
  validateRecovery,
} from "@repo/backend/confect/contentRelease/activation/validate";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  insertActivationPair,
  makeActivationPair,
} from "@repo/backend/test/content/activation";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import { Effect } from "effect";

describe("activation identity validation", () => {
  it.effect("rejects activation using another manifest identity", () =>
    Effect.gen(function* () {
      const { candidate, recovery } = makeActivationPair();
      const rendererJson = encodeRendererJson(TEST_PROOF_RENDERER);
      expect(
        yield* validateActivationRenderer(
          candidate.manifest.releaseId,
          encodeReleaseJson(candidate),
          rendererJson,
          rendererJson,
          recovery.manifestHash
        ).pipe(Effect.flip)
      ).toMatchObject({
        code: "CONTENT_RELEASE_CONFLICT",
      });
    })
  );
  it.effect(
    "rejects a recovery whose frozen state changed after candidate verification",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const { candidate, recovery } = makeActivationPair();
            yield* insertActivationPair(tCtx, candidate, recovery);
            yield* Effect.gen(function* () {
              const row = yield* Effect.promise(() =>
                tCtx.db
                  .query("contentReleases")
                  .withIndex("by_releaseId", (q) =>
                    q.eq("releaseId", recovery.manifest.releaseId)
                  )
                  .unique()
              );
              if (!row) {
                throw new Error("Expected the retained inverse.");
              }
              yield* Effect.promise(() =>
                tCtx.db.patch("contentReleases", row._id, {
                  status: "staging",
                })
              );
            });
            expect(
              yield* validateCandidate(
                candidate.manifest.releaseId,
                encodeRendererJson(TEST_PROOF_RENDERER),
                candidate.manifestHash
              ).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect(
    "rejects recovery activation while a candidate still owns its publication slot",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const { candidate, recovery } = makeActivationPair();
            yield* insertActivationPair(tCtx, candidate, recovery);
            expect(
              yield* validateRecovery(
                recovery.manifest.releaseId,
                encodeRendererJson(TEST_PROOF_RENDERER),
                recovery.manifestHash
              ).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_STATE",
            });
          })
        );
      })
  );
});
