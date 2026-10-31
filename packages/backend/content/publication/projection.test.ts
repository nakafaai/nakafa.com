import { describe, expect, it } from "@effect/vitest";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import {
  contentHead,
  resolveBoundPublicProjection,
  resolveContentHead,
  resolvePublicProjection,
} from "@repo/backend/content/publication/projection";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
import {
  createTestPublication,
  makePageRuntimeSource,
} from "@repo/backend/test/content/publication";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { insertRuntimeVersion } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { Effect, HashMap, Struct } from "effect";

describe("immutable publication projections", () => {
  it.effect("rejects withdrawn or incomplete selected route bindings", () =>
    Effect.gen(function* () {
      const fixture = yield* makePageRuntimeSource();
      const runtime = yield* createTestPublication(fixture.source);
      yield* runtime.run(
        Effect.gen(function* () {
          for (const binding of [
            {
              ...fixture.binding,
              operation: "delete" as const,
            },
            Struct.omit(fixture.binding, ["contentKey"]),
          ]) {
            expect(
              yield* resolveBoundPublicProjection(
                binding,
                fixture.state.activeSequence
              ).pipe(Effect.flip, Effect.orDie)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }
        }).pipe(Effect.provide(publicationLayer))
      );
    })
  );
  it.effect("excludes an authenticated head from public routing", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() => insertRuntimeRelease(ctx));
          yield* Effect.promise(() =>
            insertRuntimeVersion(ctx, "authenticated", "test:protected")
          );
        })
      );
      yield* target.run(
        Effect.gen(function* () {
          expect(
            yield* resolvePublicProjection(
              "test:protected",
              "en",
              TEST_RUNTIME_RELEASE.sequence
            )
          ).toBeNull();
        }).pipe(Effect.provide(publicationLayer))
      );
    })
  );
  it.effect("rejects incomplete or invalid head contracts", () =>
    Effect.gen(function* () {
      const fixture = yield* makePageRuntimeSource();
      const runtime = yield* createTestPublication(fixture.source);
      for (const head of [
        {
          ...fixture.head,
          compilerConfigHash: "not-a-digest",
        },
        {
          ...fixture.head,
          sourcePath: "outside-corpus.mdx",
        },
        Struct.omit(fixture.head, ["artifactHash"]),
      ]) {
        yield* runtime.run(
          Effect.gen(function* () {
            expect(
              yield* contentHead(head, fixture.state.activeSequence).pipe(
                Effect.flip,
                Effect.orDie
              )
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }).pipe(Effect.provide(publicationLayer))
        );
      }
    })
  );
  it.effect(
    "binds stored projection family, locale, hash, and renderer provenance",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makePageRuntimeSource();
        const heads: readonly PublicationRow<"contentHeads">[] = [
          Struct.omit(fixture.head, ["projectionHash"]),
          {
            ...fixture.head,
            family: "material",
          },
          {
            ...fixture.head,
            projectionJson: canonicalizePublicPageProjection(
              makeTestPageProjection("id")
            ),
          },
          {
            ...fixture.head,
            projectionHash: `sha256:${"f".repeat(64)}`,
          },
          Struct.omit(fixture.head, ["rendererDomain"]),
          Struct.omit(fixture.head, ["sourcePath"]),
        ];
        for (const head of heads) {
          const runtime = yield* createTestPublication(
            HashMap.set(HashMap.fromIterable(fixture.source), "contentHeads", [
              head,
            ])
          );
          yield* runtime.run(
            Effect.gen(function* () {
              expect(
                yield* resolvePublicProjection(
                  fixture.projection.contentKey,
                  fixture.projection.artifactLocale,
                  fixture.state.activeSequence
                ).pipe(Effect.flip, Effect.orDie)
              ).toMatchObject({
                code: "CONTENT_RELEASE_INTEGRITY",
              });
            }).pipe(Effect.provide(publicationLayer))
          );
        }
        const runtime = yield* createTestPublication(
          HashMap.set(HashMap.fromIterable(fixture.source), "contentHeads", [
            Struct.omit(fixture.head, ["projectionJson"]),
          ])
        );
        yield* runtime.run(
          Effect.gen(function* () {
            expect(
              yield* resolveContentHead(
                fixture.projection.contentKey,
                fixture.projection.artifactLocale,
                fixture.state.activeSequence
              ).pipe(Effect.flip, Effect.orDie)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }).pipe(Effect.provide(publicationLayer))
        );
      })
  );
});
