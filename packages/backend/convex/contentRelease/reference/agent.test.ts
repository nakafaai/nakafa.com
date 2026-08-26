import { readAgentContentSource } from "@repo/backend/convex/contentRelease/reference/agent";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/reference/agent", () => {
  it("returns no source when the signed reference is absent", async () => {
    const test = convexTest(schema, convexModules);

    await expect(
      test.query((ctx) =>
        runConvexProgram(
          readAgentContentSource(ctx, {
            appLocale: "en",
            kind: "route",
            publicPath: "quran/1",
          })
        )
      )
    ).resolves.toBeNull();
  });

  it("returns the Quran reference and markdown from one query", async () => {
    const test = convexTest(schema, convexModules);
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(1),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        makeQuranSearch("en", 1),
      ])
    );

    const source = await test.query((ctx) =>
      runConvexProgram(
        readAgentContentSource(ctx, {
          appLocale: "en",
          kind: "route",
          publicPath: "quran/1",
        })
      )
    );

    expect(source).toMatchObject({
      kind: "quran",
      markdown: {
        appLocale: "en",
        surah: { number: 1 },
        verses: [{ number: { inSurah: 1 } }],
      },
      reference: {
        content_id: "asset:en:quran:quran-surah:1",
        locale: "en",
        route: "quran/1",
        section: "quran",
      },
    });
  });
});
