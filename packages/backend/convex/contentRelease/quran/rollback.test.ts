import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { readQuranLocaleSources } from "@repo/backend/convex/contentRelease/quran/sources";
import { readQuranSurahRow } from "@repo/backend/convex/contentRelease/quran/surah";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  encodeRollbackQuranRow,
  makeQuranSearch,
  makeRollbackQuranAttribution,
  makeRollbackQuranRecord,
  makeRollbackQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const snapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);

/** Inserts one retained rollback surah with an optional integrity defect. */
async function insertRollbackSurah(
  ctx: MutationCtx,
  defect?: "index" | "payload"
) {
  const payload = makeRollbackQuranSurah(1);
  const record = makeRollbackQuranRecord(snapshotId, payload);
  const rowJson = encodeRollbackQuranRow(snapshotId, payload);
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

/** Activates a snapshot carrying the exact retained attribution contract. */
async function activateRollbackAttribution(ctx: MutationCtx) {
  const activeSnapshotId = await activateQuranSnapshot(ctx, [
    makeQuranSearch("en", 1),
  ]);
  const payload = makeRollbackQuranAttribution();
  const record = makeRollbackQuranRecord(activeSnapshotId, payload);
  await ctx.db.insert("quranRows", {
    identity: `attribution:${payload.sources.map(({ id }) => id).join(":")}`,
    index: 0,
    kind: payload.kind,
    rowHash: record.rowHash,
    rowJson: encodeRollbackQuranRow(activeSnapshotId, payload),
    snapshotId: activeSnapshotId,
  });
  return activeSnapshotId;
}

describe("contentRelease/quran rollback", () => {
  it.live("authenticates and upgrades an exact retained surah", () =>
    Effect.gen(function* () {
      const active = convexTest(schema, convexModules);
      yield* Effect.promise(() => active.mutation(insertRollbackSurah));
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
          active.mutation((ctx) => insertRollbackSurah(ctx, defect))
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

  it.live("projects the retained attribution without inventing access", () =>
    Effect.gen(function* () {
      const active = convexTest(schema, convexModules);
      const activeSnapshotId = yield* Effect.promise(() =>
        active.mutation(activateRollbackAttribution)
      );
      const [indonesian, english, german] = yield* Effect.all(
        [
          Effect.promise(() =>
            active.query((ctx) =>
              runConvexProgram(
                readQuranLocaleSources(ctx, activeSnapshotId, "id")
              )
            )
          ),
          Effect.promise(() =>
            active.query((ctx) =>
              runConvexProgram(
                readQuranLocaleSources(ctx, activeSnapshotId, "en")
              )
            )
          ),
          Effect.promise(() =>
            active.query((ctx) =>
              runConvexProgram(
                readQuranLocaleSources(ctx, activeSnapshotId, "de")
              )
            )
          ),
        ],
        { concurrency: "unbounded" }
      );

      expect(indonesian).toMatchObject({
        sources: {
          arabic: { id: "tanzil-text", kind: "embedded" },
          translation: { id: "quranenc-indonesian", kind: "embedded" },
        },
        tafsirAccess: {
          appLocale: "id",
          kind: "embedded",
          source: { id: "quranenc-tafsir" },
        },
      });
      expect(english).toMatchObject({
        sources: {
          arabic: { id: "tanzil-text", kind: "embedded" },
          translation: { id: "quranenc-english", kind: "embedded" },
        },
        tafsirAccess: null,
      });
      expect(german).toMatchObject({
        sources: {
          arabic: { id: "tanzil-text", kind: "embedded" },
          translation: { id: "quranenc-german", kind: "embedded" },
        },
        tafsirAccess: null,
      });
    })
  );
});
