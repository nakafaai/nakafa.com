import { describe, expect, it } from "@effect/vitest";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import {
  readPublicRouteHead,
  readRoutedPublicArtifact,
  readSelectedPublicHead,
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
import { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  createTestPublication,
  makePageRuntimeSource,
} from "@repo/backend/test/content/publication";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, HashMap, Struct } from "effect";

describe("active public body selection", () => {
  it.effect(
    "names a selected body's head and opens its artifact only by the hash that head names",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makePageRuntimeSource();
        const { appLocale, publicPath } = fixture.projection;
        const published = HashMap.set(
          HashMap.fromIterable(fixture.source),
          "contentReleases",
          [{ ...fixture.release, resultFamilies: ["page"] }]
        );
        const runtime = yield* createTestPublication(published);
        yield* runtime.run(
          Effect.gen(function* () {
            const route = yield* resolveActiveRoute(
              "page",
              appLocale,
              publicPath
            );
            expect(yield* readSelectedPublicHead(route)).toEqual({
              artifactHash: fixture.head.artifactHash,
              projectionHash: fixture.head.projectionHash,
              sourcePath: fixture.head.sourcePath,
            });
            expect(
              yield* readRoutedPublicArtifact(
                "page",
                appLocale,
                publicPath,
                fixture.artifact.artifactHash
              )
            ).toEqual({ artifactJson: encodeJsonText(fixture.artifact) });
            expect(yield* readPublicRouteHead(appLocale, publicPath)).toEqual({
              activeReleaseId: fixture.release.releaseId,
              artifactHash: fixture.artifact.artifactHash,
              family: "page",
              projectionHash: fixture.head.projectionHash,
              projectionJson: fixture.head.projectionJson,
              sourcePath: fixture.head.sourcePath,
            });
            expect(yield* readPublicRouteHead(appLocale, "missing")).toBeNull();
            for (const [family, path, hash] of [
              ["page", publicPath, `sha256:${"0".repeat(64)}`],
              ["page", "missing", fixture.artifact.artifactHash],
              ["article", publicPath, fixture.artifact.artifactHash],
            ] as const) {
              expect(
                yield* readRoutedPublicArtifact(family, appLocale, path, hash)
              ).toBeNull();
            }
          }).pipe(Effect.provide(publicationLayer))
        );
        const empty = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* empty.run(
          resolveActiveRoute("page", "en", "missing").pipe(
            Effect.flatMap(readSelectedPublicHead),
            Effect.tap((head) => Effect.sync(() => expect(head).toBeNull())),
            Effect.andThen(readPublicRouteHead("en", "missing")),
            Effect.tap((head) => Effect.sync(() => expect(head).toBeNull())),
            Effect.asVoid,
            Effect.provide(publicationLayer)
          )
        );
      })
  );
  it.effect(
    "rejects a selected body that lost its artifact hash or carries another artifact's provenance",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makePageRuntimeSource();
        const { appLocale, publicPath } = fixture.projection;
        const published = HashMap.set(
          HashMap.fromIterable(fixture.source),
          "contentReleases",
          [{ ...fixture.release, resultFamilies: ["page"] }]
        );
        const hashless = yield* createTestPublication(
          HashMap.set(published, "contentHeads", [
            Struct.omit(fixture.head, ["artifactHash"]),
          ])
        );
        yield* hashless.run(
          Effect.gen(function* () {
            const route = yield* resolveActiveRoute(
              "page",
              appLocale,
              publicPath
            );
            expect(
              yield* readSelectedPublicHead(route).pipe(
                Effect.flip,
                Effect.orDie
              )
            ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
          }).pipe(Effect.provide(publicationLayer))
        );
        const foreign = yield* createTestPublication(
          HashMap.set(published, "contentHeads", [
            {
              ...fixture.head,
              compilerConfigHash: `sha256:${"f".repeat(64)}`,
            },
          ])
        );
        yield* foreign.run(
          readRoutedPublicArtifact(
            "page",
            appLocale,
            publicPath,
            fixture.artifact.artifactHash
          ).pipe(
            Effect.flip,
            Effect.orDie,
            Effect.tap((error) =>
              Effect.sync(() =>
                expect(error).toMatchObject({
                  code: "CONTENT_RELEASE_INTEGRITY",
                })
              )
            ),
            Effect.asVoid,
            Effect.provide(publicationLayer)
          )
        );
      })
  );
  it.effect("preserves exact request order when no publication is active", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      const requests = [
        {
          appLocale: "en",
          publicPath: "about",
        },
        {
          appLocale: "id",
          publicPath: "about",
        },
      ] as const;
      yield* target.run(
        Effect.gen(function* () {
          expect(yield* resolvePublicRoutes(requests)).toEqual([null, null]);
        }).pipe(Effect.provide(publicationLayer))
      );
    })
  );
  it.effect(
    "rejects a route whose stored binding or active body is incomplete",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makePageRuntimeSource();
        const incomplete: readonly PublicationRow<"contentHeads">[] = [
          Struct.omit(fixture.head, ["artifactHash"]),
          Struct.omit(fixture.head, ["compilerConfigHash"]),
          Struct.omit(fixture.head, ["projectionHash"]),
          Struct.omit(fixture.head, ["projectionJson"]),
          Struct.omit(fixture.head, ["rendererDomain"]),
          Struct.omit(fixture.head, ["sourceHash"]),
          Struct.omit(fixture.head, ["sourcePath"]),
        ];
        const base = HashMap.fromIterable(fixture.source);
        const sources = [
          HashMap.set(base, "contentBindings", [
            Struct.omit(fixture.binding, ["contentKey"]),
          ]),
          HashMap.set(base, "contentHeads", []),
          ...Arr.map(incomplete, (head) =>
            HashMap.set(base, "contentHeads", [head])
          ),
        ];
        for (const source of sources) {
          const runtime = yield* createTestPublication(source);
          yield* runtime.run(
            Effect.gen(function* () {
              expect(
                yield* resolvePublicRoute(
                  fixture.projection.appLocale,
                  fixture.projection.publicPath
                ).pipe(Effect.flip, Effect.orDie)
              ).toMatchObject({
                code: "CONTENT_RELEASE_INTEGRITY",
              });
            }).pipe(Effect.provide(publicationLayer))
          );
        }
      })
  );
});
