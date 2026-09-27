import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
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
  it("rejects a malformed signed publication result before reading markdown", async () => {
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
        .mockResolvedValueOnce(false);
      const error = await Effect.runPromise(
        getNakafaContent(`https://nakafa.com/en/${article.publicPath}`).pipe(
          Effect.flip,
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      );
      expect(error).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to read signed Nakafa public content.",
      });
    });
  });
  it("does not query publication for an unrecognized reference", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.action(async (ctx) => {
      const query = vi.spyOn(ctx, "runQuery");
      expect(
        await Effect.runPromise(
          getNakafaContent("unrecognized reference").pipe(
            Effect.orDie,
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        )
      ).toEqual(Option.none());
      expect(query).not.toHaveBeenCalled();
    });
  });
  it("returns no content for an absent current reference", async () => {
    const test = createConvexTestWithBetterAuth();
    expect(
      await test.action((ctx) =>
        Effect.runPromise(
          getNakafaContent(
            "https://nakafa.com/en/articles/politics/missing"
          ).pipe(
            Effect.orDie,
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
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
        {
          ...search,
          graph: {
            ...search.graph,
            assetId: "asset:en",
          },
        },
      ])
    );
    await test.action(async (ctx) => {
      const failure = await Effect.runPromise(
        getNakafaContent("https://nakafa.com/en/quran/1").pipe(
          Effect.flip,
          Effect.orDie,
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
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
        await Effect.runPromise(
          getNakafaContent(`https://nakafa.com/en/${article.publicPath}`).pipe(
            Effect.orDie,
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
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
        input: {
          kind: "route",
          appLocale: "en",
          publicPath: first.publicPath,
        },
      }
    );
    const row = await test.query(
      internal.contentRelease.runtime.publication.internal.read,
      {
        appLocale: "en",
        publicPath: second.publicPath,
      }
    );
    await test.action(async (ctx) => {
      vi.spyOn(ctx, "runQuery")
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(row);
      const failure = await Effect.runPromise(
        getNakafaContent(`https://nakafa.com/en/${first.publicPath}`).pipe(
          Effect.flip,
          Effect.orDie,
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
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
    await materials.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog([material], ["en"]).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const row = await materials.query(
      internal.contentRelease.runtime.publication.internal.read,
      {
        appLocale: "en",
        publicPath: material.publicPath,
      }
    );
    await test.action(async (ctx) => {
      vi.spyOn(ctx, "runQuery")
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(row);
      const failure = await Effect.runPromise(
        getNakafaContent(`https://nakafa.com/en/${article.publicPath}`).pipe(
          Effect.flip,
          Effect.orDie,
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      );
      expect(failure).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        cause: "The signed projection changed its requested public identity.",
      });
    });
  });
});
