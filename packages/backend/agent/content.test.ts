import { describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import { internal } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect, Option } from "effect";

describe("agent/content", () => {
  it("does not query publication for an unrecognized reference", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.action(async (ctx) => {
      const query = vi.spyOn(ctx, "runQuery");
      expect(
        await runConvexProgram(
          getNakafaContent(ctx, "unrecognized reference").pipe(Effect.orDie)
        )
      ).toEqual(Option.none());
      expect(query).not.toHaveBeenCalled();
    });
  });

  it("returns no content for an absent current reference", async () => {
    const test = createConvexTestWithBetterAuth();
    expect(
      await test.action((ctx) =>
        runConvexProgram(
          getNakafaContent(
            ctx,
            "https://nakafa.com/en/articles/politics/missing"
          ).pipe(Effect.orDie)
        )
      )
    ).toEqual(Option.none());
  });

  it("fails closed for a signed graph too short to identify a public asset", async () => {
    const test = createConvexTestWithBetterAuth();
    const search = makeQuranSearch("en", 1);
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        makeQuranSurah(1),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        { ...search, graph: { ...search.graph, assetId: "asset:en" } },
      ])
    );
    await test.action(async (ctx) => {
      const failure = await runConvexProgram(
        getNakafaContent(ctx, "https://nakafa.com/en/quran/1").pipe(
          Effect.flip,
          Effect.orDie
        )
      );
      expect(failure).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        cause: "The signed content reference has an invalid graph identity.",
      });
    });
  });

  it("returns no markdown when content is retired between reference and body reads", async () => {
    const test = createConvexTestWithBetterAuth();
    const article = testArticleProjection(0);
    await test.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const source = await test.query(
      internal.contentRelease.reference.internal.readAgentContent,
      {
        input: {
          kind: "route",
          appLocale: "en",
          publicPath: article.publicPath,
        },
      }
    );
    await test.action(async (ctx) => {
      vi.spyOn(ctx, "runQuery")
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(null);
      expect(
        await runConvexProgram(
          getNakafaContent(
            ctx,
            `https://nakafa.com/en/${article.publicPath}`
          ).pipe(Effect.orDie)
        )
      ).toEqual(Option.none());
    });
  });

  it("rejects a changed asset between reference and body reads", async () => {
    const test = createConvexTestWithBetterAuth();
    const first = testArticleProjection(0);
    const second = testArticleProjection(1);
    await test.mutation((ctx) => insertRuntimeArticles(ctx, 2));
    const source = await test.query(
      internal.contentRelease.reference.internal.readAgentContent,
      {
        input: { kind: "route", appLocale: "en", publicPath: first.publicPath },
      }
    );
    const row = await test.query(
      internal.contentRelease.runtime.public.internal.read,
      { appLocale: "en", publicPath: second.publicPath }
    );
    await test.action(async (ctx) => {
      vi.spyOn(ctx, "runQuery")
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(row);
      const failure = await runConvexProgram(
        getNakafaContent(ctx, `https://nakafa.com/en/${first.publicPath}`).pipe(
          Effect.flip,
          Effect.orDie
        )
      );
      expect(failure).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        cause: "The signed projection changed its requested public identity.",
      });
    });
  });

  it("rejects a changed content family between reference and body reads", async () => {
    const test = createConvexTestWithBetterAuth();
    const article = testArticleProjection(0);
    await test.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const source = await test.query(
      internal.contentRelease.reference.internal.readAgentContent,
      {
        input: {
          kind: "route",
          appLocale: "en",
          publicPath: article.publicPath,
        },
      }
    );
    const materials = createConvexTestWithBetterAuth();
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(materials, [material], ["en"]);
    const row = await materials.query(
      internal.contentRelease.runtime.public.internal.read,
      { appLocale: "en", publicPath: material.publicPath }
    );
    await test.action(async (ctx) => {
      vi.spyOn(ctx, "runQuery")
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(row);
      const failure = await runConvexProgram(
        getNakafaContent(
          ctx,
          `https://nakafa.com/en/${article.publicPath}`
        ).pipe(Effect.flip, Effect.orDie)
      );
      expect(failure).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        cause: "The signed projection changed its requested public identity.",
      });
    });
  });
});
