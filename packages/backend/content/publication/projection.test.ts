import { describe, expect, it } from "@effect/vitest";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  contentHead,
  resolveContentHead,
  resolvePublicProjection,
} from "@repo/backend/content/publication/projection";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
import {
  createTestPublication,
  makePageRuntimeSource,
} from "@repo/backend/test/content/publication";
import {
  TEST_QUESTION_CONTENT_KEY,
  TEST_QUESTION_PROJECTION_JSON,
  TEST_QUESTION_SOURCE,
} from "@repo/backend/test/content/question";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { insertRuntimeVersion } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("immutable publication projections", () => {
  it("preserves an unrouted protected head and excludes question bodies from public routing", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeVersion(
        ctx,
        "authenticated",
        TEST_QUESTION_CONTENT_KEY,
        {
          projectionJson: TEST_QUESTION_PROJECTION_JSON,
          rendererDomain: "snbt-quant",
          sourcePath: TEST_QUESTION_SOURCE,
        }
      );
    });
    const read = () =>
      target.query((ctx) =>
        runConvexProgram(
          Effect.all({
            head: resolveContentHead(
              TEST_QUESTION_CONTENT_KEY,
              "en",
              TEST_RUNTIME_RELEASE.sequence
            ),
            projection: resolvePublicProjection(
              TEST_QUESTION_CONTENT_KEY,
              "en",
              TEST_RUNTIME_RELEASE.sequence
            ),
          }).pipe(Effect.provide(convexPublicationLayer(ctx)))
        )
      );
    const protectedResult = await read();
    expect(protectedResult.head).toMatchObject({
      contentKey: TEST_QUESTION_CONTENT_KEY,
      family: "question",
      delivery: "authenticated",
    });
    expect(protectedResult.head).not.toHaveProperty("publicPath");
    expect(protectedResult.projection).toBeNull();
    await target.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        return expect.fail("Expected one immutable question head.");
      }
      await ctx.db.patch(head._id, { delivery: "public" });
    });
    expect((await read()).projection).toBeNull();
  });

  it.effect("rejects incomplete or invalid head contracts", () =>
    Effect.gen(function* () {
      const fixture = makePageRuntimeSource();
      const runtime = yield* createTestPublication(fixture.source);
      for (const patch of [
        { compilerConfigHash: "not-a-digest" },
        { sourcePath: "outside-corpus.mdx" },
        { artifactHash: undefined },
      ]) {
        yield* Effect.promise(() =>
          runtime.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                expect(
                  yield* contentHead(
                    { ...fixture.head, ...patch },
                    fixture.state.activeSequence
                  ).pipe(Effect.flip, Effect.orDie)
                ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
              }).pipe(Effect.provide(convexPublicationLayer(ctx)))
            )
          )
        );
      }
    })
  );

  it.effect(
    "binds stored projection family, locale, hash, and renderer provenance",
    () =>
      Effect.gen(function* () {
        const fixture = makePageRuntimeSource();
        const patches: readonly Partial<PublicationRow<"contentHeads">>[] = [
          { projectionHash: undefined },
          { family: "material" },
          {
            projectionJson: canonicalizePublicPageProjection(
              makeTestPageProjection("id")
            ),
          },
          { projectionHash: `sha256:${"f".repeat(64)}` },
          { rendererDomain: undefined },
          { sourcePath: undefined },
        ];
        for (const patch of patches) {
          const runtime = yield* createTestPublication(
            new Map(fixture.source).set("contentHeads", [
              { ...fixture.head, ...patch },
            ])
          );
          yield* Effect.promise(() =>
            runtime.query((ctx) =>
              runConvexProgram(
                Effect.gen(function* () {
                  expect(
                    yield* resolvePublicProjection(
                      fixture.projection.contentKey,
                      fixture.projection.artifactLocale,
                      fixture.state.activeSequence
                    ).pipe(Effect.flip, Effect.orDie)
                  ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
                }).pipe(Effect.provide(convexPublicationLayer(ctx)))
              )
            )
          );
        }
        const runtime = yield* createTestPublication(
          new Map(fixture.source).set("contentHeads", [
            { ...fixture.head, projectionJson: undefined },
          ])
        );
        yield* Effect.promise(() =>
          runtime.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                expect(
                  yield* resolveContentHead(
                    fixture.projection.contentKey,
                    fixture.projection.artifactLocale,
                    fixture.state.activeSequence
                  ).pipe(Effect.flip, Effect.orDie)
                ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
              }).pipe(Effect.provide(convexPublicationLayer(ctx)))
            )
          )
        );
      })
  );
});
