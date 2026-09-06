import { describe, expect, it } from "@effect/vitest";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
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
