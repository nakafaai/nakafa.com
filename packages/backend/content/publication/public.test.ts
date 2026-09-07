import { describe, expect, it } from "@effect/vitest";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  readSelectedPublicRuntime,
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
import { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  createTestPublication,
  makePageRuntimeSource,
} from "@repo/backend/test/content/publication";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("active public body selection", () => {
  it.effect(
    "preserves selected absence and rejects invalid artifact, source, and release provenance",
    () =>
      Effect.gen(function* () {
        const fixture = makePageRuntimeSource();
        const published = new Map(fixture.source).set("contentReleases", [
          { ...fixture.release, resultFamilies: ["page"] },
        ]);
        const sources = [
          new Map(published).set("contentHeads", [
            { ...fixture.head, compilerConfigHash: `sha256:${"f".repeat(64)}` },
          ]),
          new Map(published).set("contentHeads", [
            { ...fixture.head, sourcePath: "outside-corpus.mdx" },
          ]),
          new Map(published)
            .set("contentState", [
              { ...fixture.state, activeReleaseId: "different-release" },
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
          yield* Effect.promise(() =>
            runtime.query((ctx) =>
              runConvexProgram(
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
                  ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
                }).pipe(Effect.provide(convexPublicationLayer(ctx)))
              )
            )
          );
        }
        const empty = yield* createTestPublication(new Map());
        yield* Effect.promise(() =>
          empty.query((ctx) =>
            runConvexProgram(
              resolveActiveRoute("page", "en", "missing").pipe(
                Effect.flatMap(readSelectedPublicRuntime),
                Effect.tap((runtime) =>
                  Effect.sync(() => expect(runtime).toBeNull())
                ),
                Effect.provide(convexPublicationLayer(ctx))
              )
            )
          )
        );
      })
  );

  it("preserves exact request order when no publication is active", async () => {
    const target = convexTest(schema, convexModules);
    const requests = [
      { appLocale: "en", publicPath: "about" },
      { appLocale: "id", publicPath: "about" },
    ] as const;
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          resolvePublicRoutes(requests).pipe(
            Effect.provide(convexPublicationLayer(ctx))
          )
        )
      )
    ).resolves.toEqual([null, null]);
  });

  it.effect(
    "rejects a route whose stored binding or active body is incomplete",
    () =>
      Effect.gen(function* () {
        const fixture = makePageRuntimeSource();
        const incomplete: readonly Partial<PublicationRow<"contentHeads">>[] = [
          { artifactHash: undefined },
          { compilerConfigHash: undefined },
          { projectionHash: undefined },
          { projectionJson: undefined },
          { rendererDomain: undefined },
          { sourceHash: undefined },
          { sourcePath: undefined },
        ];
        const sources = [
          new Map(fixture.source).set("contentBindings", [
            { ...fixture.binding, contentKey: undefined },
          ]),
          new Map(fixture.source).set("contentHeads", []),
          ...incomplete.map((patch) =>
            new Map(fixture.source).set("contentHeads", [
              { ...fixture.head, ...patch },
            ])
          ),
        ];
        for (const source of sources) {
          const runtime = yield* createTestPublication(source);
          yield* Effect.promise(() =>
            runtime.query((ctx) =>
              runConvexProgram(
                Effect.gen(function* () {
                  expect(
                    yield* resolvePublicRoute(
                      fixture.projection.appLocale,
                      fixture.projection.publicPath
                    ).pipe(Effect.flip, Effect.orDie)
                  ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
                }).pipe(Effect.provide(convexPublicationLayer(ctx)))
              )
            )
          );
        }
      })
  );
});
