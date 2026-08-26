import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { readQuranSurahRow } from "@repo/backend/convex/contentRelease/quran/surah";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  encodeLegacyQuranRow,
  makeLegacyQuranRecord,
  makeLegacyQuranSurah,
} from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const snapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);

/** Inserts one authentic legacy surah with an optional integrity defect. */
async function insertLegacySurah(
  ctx: MutationCtx,
  defect?: "index" | "payload"
) {
  const payload = makeLegacyQuranSurah(1);
  const record = makeLegacyQuranRecord(snapshotId, payload);
  const rowJson = encodeLegacyQuranRow(snapshotId, payload);
  await ctx.db.insert("quranRows", {
    identity: `surah:${payload.number}`,
    index: payload.number,
    kind: payload.kind,
    rowHash: record.rowHash,
    rowJson:
      defect === "payload"
        ? rowJson.replace(
            '"translation":"Technical meaning 1"',
            '"translation":1'
          )
        : rowJson,
    snapshotId,
    surahNumber: defect === "index" ? 2 : payload.number,
  });
}

describe("contentRelease/quran/legacy", () => {
  it.live("authenticates and upgrades an exact 0.15.1 surah", () =>
    Effect.gen(function* () {
      const active = convexTest(schema, convexModules);
      yield* Effect.promise(() => active.mutation(insertLegacySurah));
      const row = yield* Effect.promise(() =>
        active.query((ctx) =>
          runConvexProgram(readQuranSurahRow(ctx, snapshotId, 1))
        )
      );

      expect(row.payload.name.meaning).toEqual({
        appLocale: "en",
        text: "Technical meaning 1",
      });
    })
  );

  it.live("rejects malformed payloads and mismatched stored indexes", () =>
    Effect.gen(function* () {
      for (const defect of ["payload", "index"] as const) {
        const active = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          active.mutation((ctx) => insertLegacySurah(ctx, defect))
        );
        yield* Effect.promise(() =>
          expect(
            active.query((ctx) =>
              runConvexProgram(readQuranSurahRow(ctx, snapshotId, 1))
            )
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      }
    })
  );
});
