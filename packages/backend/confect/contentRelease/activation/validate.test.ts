import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  validateActivationRenderer,
  validateCandidate,
  validateRecovery,
} from "@repo/backend/confect/contentRelease/activation/validate";
import { CURRENT_CONTENT_GENERATION } from "@repo/backend/confect/contentRelease/generation";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  BOOTSTRAP,
  BOOTSTRAP_RECOVERY,
  seedActiveBootstrap,
  seedRetiredCandidate,
} from "@repo/backend/test/activation/fixture";
import {
  insertActivationPair,
  makeActivationPair,
} from "@repo/backend/test/content/activation";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import { testRendererJson } from "@repo/backend/test/content/release";
import { Effect, Option } from "effect";

describe("activation identity validation", () => {
  it.effect("rejects activation using another manifest identity", () =>
    Effect.gen(function* () {
      const { candidate, recovery } = yield* makeActivationPair();
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
            const { candidate, recovery } = yield* makeActivationPair();
            yield* insertActivationPair(tCtx, candidate, recovery);
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
            const { candidate, recovery } = yield* makeActivationPair();
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

describe("activation bootstrap validation", () => {
  it.effect("activates a stored bootstrap without a retained inverse", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            seedRetiredCandidate(tCtx, { bootstrap: true })
          );
          const validated = yield* validateCandidate(
            BOOTSTRAP.releaseId,
            testRendererJson(),
            BOOTSTRAP.manifestHash
          );
          expect(Option.isNone(validated.inverse)).toBe(true);
        })
      );
    })
  );

  it.effect(
    "keeps the retained inverse for an undeclared candidate over a current generation",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              seedRetiredCandidate(tCtx, {
                bootstrap: false,
                generation: CURRENT_CONTENT_GENERATION,
                recovery: true,
              })
            );
            const validated = yield* validateCandidate(
              BOOTSTRAP.releaseId,
              testRendererJson(),
              BOOTSTRAP.manifestHash
            );
            expect(
              Option.getOrUndefined(validated.inverse)?.recovery.releaseId
            ).toBe(BOOTSTRAP_RECOVERY.releaseId);
          })
        );
      })
  );

  it.effect.each([
    {
      message: "no longer meets the bootstrap contract",
      name: "a stored bootstrap once a recovery is staged",
      options: { bootstrap: true, recovery: true },
    },
    {
      message: "no longer meets the bootstrap contract",
      name: "a stored bootstrap over a current generation",
      options: { bootstrap: true, generation: CURRENT_CONTENT_GENERATION },
    },
    {
      message: "lacks a verified retained recovery",
      name: "an undeclared candidate over the retired generation without a recovery",
      options: { bootstrap: false },
    },
    {
      message: "extends a retired content generation",
      name: "an undeclared candidate over the retired generation with an inverse",
      options: { bootstrap: false, recovery: true },
    },
  ])("refuses $name", ({ message, options }) =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => seedRetiredCandidate(tCtx, options));
          expect(
            yield* validateCandidate(
              BOOTSTRAP.releaseId,
              testRendererJson(),
              BOOTSTRAP.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining(message),
          });
        })
      );
    })
  );

  it.effect("refuses a candidate that is not verified in its slot", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            seedRetiredCandidate(tCtx, { bootstrap: true })
          );
          const candidate = yield* Effect.promise(() =>
            tCtx.db
              .query("contentReleases")
              .withIndex("by_releaseId", (query) =>
                query.eq("releaseId", BOOTSTRAP.releaseId)
              )
              .unique()
          );
          if (!candidate) {
            throw new Error("Expected the staged candidate.");
          }
          yield* Effect.promise(() =>
            tCtx.db.patch("contentReleases", candidate._id, {
              status: "staging",
            })
          );
          expect(
            yield* validateCandidate(
              BOOTSTRAP.releaseId,
              testRendererJson(),
              BOOTSTRAP.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining("is not the verified candidate"),
          });
        })
      );
    })
  );

  it.effect("refuses recovery over an active bootstrap", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => seedActiveBootstrap(tCtx));
          expect(
            yield* validateRecovery(
              BOOTSTRAP_RECOVERY.releaseId,
              testRendererJson(),
              BOOTSTRAP_RECOVERY.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_UNSUPPORTED",
            message: expect.stringContaining(
              "Publish a new release instead of rolling back across the contract change"
            ),
          });
        })
      );
    })
  );
});
