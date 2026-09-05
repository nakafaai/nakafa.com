import { assert, describe, expect, it } from "@effect/vitest";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makePageRuntimeSource } from "@repo/backend/test/content/snapshot";
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
        const tables = yield* projectActiveRuntime(fixture.source);
        const head = tables.contentHeads.find(
          (row) => row.contentKey === fixture.projection.contentKey
        );
        assert(head, "Expected the page's immutable content head.");
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
          {
            ...tables,
            contentBindings: tables.contentBindings.map((row) => ({
              ...row,
              contentKey: undefined,
            })),
          },
          { ...tables, contentHeads: [] },
          ...incomplete.map((patch) => ({
            ...tables,
            contentHeads: tables.contentHeads.map((row) =>
              row === head ? { ...row, ...patch } : row
            ),
          })),
        ];
        for (const source of sources) {
          expect(
            yield* resolvePublicRoute(
              fixture.projection.appLocale,
              fixture.projection.publicPath
            ).pipe(
              Effect.provide(snapshotPublicationLayer(source)),
              Effect.flip
            )
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }
      })
  );
});
