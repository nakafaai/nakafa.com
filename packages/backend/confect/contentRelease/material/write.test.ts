import { describe, expect, it } from "@effect/vitest";
import {
  PublicPathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { deriveMaterialTopicReference } from "@repo/backend/confect/contentRelease/material/topic";
import {
  deleteMaterial,
  writeMaterial,
} from "@repo/backend/confect/contentRelease/material/write";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { ingressProjection } from "@repo/backend/test/content/ingress";
import { Effect } from "effect";

type PublicProjection = Parameters<typeof writeMaterial>[1];
/** Builds one resolved public material projection for the writer boundary. */
function testResolved(
  options?: {
    readonly family?: PublicProjection["family"];
    readonly projectionHash?: PublicProjection["projectionHash"];
    readonly projectionJson?: string;
    readonly publicPath?: PublicProjection["publicPath"];
    readonly sequence?: number;
    readonly sourcePath?: string;
  },
  projection: MaterialLessonProjection = ingressProjection
): PublicProjection {
  return {
    appLocale: projection.appLocale,
    artifactLocale: projection.artifactLocale,
    contentKey: projection.contentKey,
    family: options?.family ?? "material",
    projectionHash:
      options?.projectionHash ?? hashContentProjection(projection),
    projectionJson:
      options?.projectionJson ?? canonicalizeMaterialProjection(projection),
    publicPath: options?.publicPath ?? projection.publicPath,
    releaseId: "release-material-write",
    rendererDomain: "mathematics",
    sequence: options?.sequence ?? 1,
    sourcePath: options?.sourcePath ?? "packages/corpus/test/head-0/en.mdx",
  };
}
describe("contentRelease/material/write", () => {
  it.effect("replaces and deletes one localized material identity", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* writeMaterial("blue", testResolved(), ingressProjection);
          const updated = {
            ...ingressProjection,
            metadata: {
              ...ingressProjection.metadata,
              dateModified: "2026-08-01",
              description: "Updated material summary.",
              title: "Updated Material",
            },
            topicTitle: "Updated Topic",
          };
          yield* writeMaterial(
            "blue",
            testResolved(
              {
                sequence: 2,
              },
              updated
            ),
            updated
          );
          yield* writeMaterial(
            "blue",
            testResolved(
              {
                sequence: 2,
              },
              updated
            ),
            updated
          );
          const [stored] = yield* Effect.promise(() =>
            tCtx.db.query("materialCatalog").take(2)
          );
          const topic = yield* deriveMaterialTopicReference(updated);
          expect(stored).toMatchObject({
            projectionJson: canonicalizeMaterialProjection(updated),
            sequence: 2,
            topicAssetId: topic.graph.assetId,
          });
          expect(stored).not.toHaveProperty("description");
          expect(stored).not.toHaveProperty("title");
          expect(stored).not.toHaveProperty("topicTitle");
          yield* deleteMaterial(
            "blue",
            ingressProjection.contentKey,
            ingressProjection.appLocale
          );
          yield* deleteMaterial(
            "blue",
            ingressProjection.contentKey,
            ingressProjection.appLocale
          );
          expect(
            yield* Effect.promise(() =>
              tCtx.db.query("materialCatalog").take(1)
            )
          ).toEqual([]);
        })
      );
    })
  );
  it.effect("rejects unsafe heads and oversized material metadata", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          for (const head of [
            testResolved({
              family: "article",
            }),
            testResolved({
              projectionHash: Sha256HashSchema.make(`sha256:${"0".repeat(64)}`),
            }),
            testResolved({
              projectionJson: "",
            }),
            testResolved({
              publicPath: PublicPathSchema.make("test/other"),
            }),
            testResolved({
              sourcePath: "",
            }),
          ]) {
            expect(
              yield* writeMaterial("blue", head, ingressProjection).pipe(
                Effect.flip
              )
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }
          expect(
            yield* Effect.gen(function* () {
              const projection = {
                ...ingressProjection,
                metadata: {
                  ...ingressProjection.metadata,
                  title: "x".repeat(900_000),
                },
              };
              return yield* writeMaterial(
                "blue",
                testResolved(undefined, projection),
                projection
              );
            }).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_SIZE",
          });
        })
      );
    })
  );
});
