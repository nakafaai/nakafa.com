import { describe, expect, it } from "@effect/vitest";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readQuranRow } from "@repo/backend/content/quran/row";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSurah } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/quran/row", () => {
  it("reads one exact verified row and rejects a missing identity", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSurah(1)])
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranRow(snapshotId, "surah:1", QuranSurahRowSchema).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      payload: { kind: "quran-surah", number: 1 },
      rowJson: expect.any(String),
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranRow(snapshotId, "surah:2", QuranSurahRowSchema).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
