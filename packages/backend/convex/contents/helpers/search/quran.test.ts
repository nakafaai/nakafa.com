import { readSignedQuranSearchDocuments } from "@repo/backend/convex/contents/helpers/search/quran";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contents/helpers/search/quran", () => {
  it("returns no source fallback before signed Quran activation", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readSignedQuranSearchDocuments(
            ctx,
            {
              limit: 10,
              locale: "en",
              offset: 0,
              queries: ["mercy"],
              section: "quran",
            },
            ["mercy"],
            10
          )
        )
      )
    ).resolves.toEqual([]);
  });

  it("authenticates full-text and exact-route hits from one signed snapshot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSearch("en", 1, "mercy guidance"),
        makeQuranSearch("en", 2, "wisdom"),
        makeQuranSearch("id", 1, "rahmat petunjuk"),
      ])
    );
    const queries = ["quran/2", "mercy", "articles/not-quran", "quran/999"];

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readSignedQuranSearchDocuments(
          ctx,
          {
            limit: 2,
            locale: "en",
            offset: 0,
            queries,
            section: "quran",
          },
          queries,
          2
        )
      )
    );

    expect(documents).toMatchObject([
      {
        content_id: "asset:en:quran:quran-surah:2",
        route: "quran/2",
        section: "quran",
        title: "Technical Surah 2",
      },
      {
        content_id: "asset:en:quran:quran-surah:1",
        route: "quran/1",
        section: "quran",
        title: "Technical Surah 1",
      },
    ]);
  });

  it("browses only the requested signed locale and respects zero limits", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSearch("en", 1),
        makeQuranSearch("id", 1),
      ])
    );

    const input = {
      limit: 10,
      locale: "id",
      offset: 0,
      section: "quran",
    } satisfies Parameters<typeof readSignedQuranSearchDocuments>[1];
    const browsed = await t.query((ctx) =>
      runConvexProgram(readSignedQuranSearchDocuments(ctx, input, [], 10))
    );
    const empty = await t.query((ctx) =>
      runConvexProgram(readSignedQuranSearchDocuments(ctx, input, [], 0))
    );

    expect(browsed.map(({ locale }) => locale)).toEqual(["id"]);
    expect(empty).toEqual([]);
  });
});
