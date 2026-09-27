import { describe, expect, it } from "@effect/vitest";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import {
  readSelectedPublicRuntime,
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
import { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  createTestPublication,
  makePageRuntimeSource,
} from "@repo/backend/test/content/publication";
import { Effect, Struct } from "effect";

describe("active public body selection", () => {
  it.effect(
    "preserves selected absence and rejects invalid artifact, source, and release provenance",
    () =>
      Effect.gen(function* () {
        const fixture = makePageRuntimeSource();
        const published = new Map(fixture.source).set("contentReleases", [
          {
            ...fixture.release,
            resultFamilies: ["page"],
          },
        ]);
        const sources = [
          new Map(published).set("contentHeads", [
            {
              ...fixture.head,
              compilerConfigHash: `sha256:${"f".repeat(64)}`,
            },
          ]),
          new Map(published).set("contentHeads", [
            {
              ...fixture.head,
              sourcePath: "outside-corpus.mdx",
            },
          ]),
          new Map(published)
            .set("contentState", [
              {
                ...fixture.state,
                activeReleaseId: "different-release",
              },
            ])
            .set("contentReleases", [
              {
                ...fixture.release,
                releaseId: "different-release",
                resultFamilies: ["page"],
              },
            ]),
        ];
        for (const source of sources) {
          const runtime = yield* createTestPublication(source);
          yield* runtime.run(
            Effect.gen(function* () {
              const route = yield* resolveActiveRoute(
                "page",
                fixture.projection.appLocale,
                fixture.projection.publicPath
              );
              expect(
                yield* readSelectedPublicRuntime(route).pipe(
                  Effect.flip,
                  Effect.orDie
                )
              ).toMatchObject({
                code: "CONTENT_RELEASE_INTEGRITY",
              });
            }).pipe(Effect.provide(publicationLayer))
          );
        }
        const empty = yield* createTestPublication(new Map());
        yield* empty.run(
          resolveActiveRoute("page", "en", "missing").pipe(
            Effect.flatMap(readSelectedPublicRuntime),
            Effect.tap((runtime) =>
              Effect.sync(() => expect(runtime).toBeNull())
            ),
            Effect.asVoid,
            Effect.provide(publicationLayer)
          )
        );
      })
  );
  it.effect("preserves exact request order when no publication is active", () =>
    Effect.gen(function* () {
      const target = yield* createTestPublication(new Map());
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
        const fixture = makePageRuntimeSource();
        const incomplete: readonly PublicationRow<"contentHeads">[] = [
          Struct.omit(fixture.head, ["artifactHash"]),
          Struct.omit(fixture.head, ["compilerConfigHash"]),
          Struct.omit(fixture.head, ["projectionHash"]),
          Struct.omit(fixture.head, ["projectionJson"]),
          Struct.omit(fixture.head, ["rendererDomain"]),
          Struct.omit(fixture.head, ["sourceHash"]),
          Struct.omit(fixture.head, ["sourcePath"]),
        ];
        const sources = [
          new Map(fixture.source).set("contentBindings", [
            Struct.omit(fixture.binding, ["contentKey"]),
          ]),
          new Map(fixture.source).set("contentHeads", []),
          ...incomplete.map((head) =>
            new Map(fixture.source).set("contentHeads", [head])
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
