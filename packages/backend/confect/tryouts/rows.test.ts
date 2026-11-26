import { assert, describe, expect, it } from "@effect/vitest";
import { ItemExplanationSchema } from "@nakafa/aksara-contracts/assessment/explanation";
import type { AssessmentRow } from "@nakafa/aksara-contracts/assessment/snapshot";
import { hashAssessmentRow } from "@nakafa/aksara-contracts/assessment/snapshot";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import {
  findActiveExplanationSnapshotId,
  readExplanation,
  readItemKey,
  readItemVersion,
  readStimulus,
} from "@repo/backend/confect/tryouts/rows";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** Builds one explanation assessment row with the given plain paragraph text. */
const makeExplanationRow = Effect.fn("test.tryouts.rows.makeExplanationRow")(
  function* (version: string, language: "id" | "en" | "de", text: string) {
    const explanation = yield* Schema.decodeEffect(ItemExplanationSchema)({
      document: {
        content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
        type: "doc",
      },
      language,
      version,
    });
    const row: AssessmentRow = { explanation, kind: "explanation" };
    const rowHash = yield* hashAssessmentRow(row);
    return {
      facts: assessmentRowFacts(row),
      rowHash,
      rowJson: canonicalizeContentSnapshotRow({
        family: "assessment",
        record: { row, rowHash },
      }),
    };
  }
);

/** Encodes a decoded explanation document to JSON text for concise assertions. */
const encodeDocument = Schema.encodeEffect(
  Schema.fromJsonString(Schema.Unknown)
);

describe("tryouts/rows readExplanation", () => {
  it.effect(
    "reads the active snapshot's explanation when an older snapshot holds the same versionHash with different text",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const oldSnapshotId = world.snapshotId;

        const firstRow = yield* Effect.promise(() =>
          world.t.query(async (ctx) => {
            const rows = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
                query.eq("snapshotId", oldSnapshotId).eq("kind", "explanation")
              )
              .collect();
            return Option.getOrNull(
              Arr.findFirst(rows, (row) => row.language === "id")
            );
          })
        );
        assert.ok(firstRow?.versionHash, "Expected a seeded explanation row.");
        const versionHash = firstRow.versionHash;

        // Publish a newer active snapshot, then update its explanation text for the same versionHash.
        const next = yield* world.release({ renamed: true });
        const updatedRow = yield* makeExplanationRow(
          versionHash,
          "id",
          "Pembahasan versi terbaru di snapshot aktif"
        );
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const activeRow = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
                query
                  .eq("snapshotId", next.snapshotId)
                  .eq("kind", "explanation")
                  .eq("identity", `${versionHash}\0id`)
              )
              .unique();
            assert.ok(activeRow, "Expected explanation in active snapshot.");
            await ctx.db.patch("assessmentRows", activeRow._id, {
              rowHash: updatedRow.rowHash,
              rowJson: updatedRow.rowJson,
            });
          })
        );

        const result = yield* world.run(
          Effect.gen(function* () {
            const activeSnapshotId = yield* findActiveExplanationSnapshotId();
            const read = yield* readExplanation({
              activeSnapshotId,
              fallbackSnapshotId: oldSnapshotId,
              language: "id",
              versionHash,
            });
            return {
              activeSnapshotId: Option.getOrNull(activeSnapshotId),
              document: Option.getOrNull(read),
            };
          })
        );
        expect(result.activeSnapshotId).toBe(next.snapshotId);
        assert.ok(result.document, "Expected active explanation.");
        expect(yield* encodeDocument(result.document)).toContain(
          "Pembahasan versi terbaru di snapshot aktif"
        );
      })
  );

  it.effect(
    "never leaks an explanation from a candidate or staged snapshot that is not active",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const activeRow = yield* Effect.promise(() =>
          world.t.query(async (ctx) => {
            const rows = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
                query
                  .eq("snapshotId", world.snapshotId)
                  .eq("kind", "explanation")
              )
              .collect();
            return Option.getOrNull(
              Arr.findFirst(rows, (row) => row.language === "id")
            );
          })
        );
        assert.ok(activeRow?.versionHash, "Expected a seeded explanation row.");
        const versionHash = activeRow.versionHash;

        // Insert a staged/candidate snapshot row with the same versionHash and language.
        const candidateRow = yield* makeExplanationRow(
          versionHash,
          "id",
          "Pembahasan candidate yang belum aktif"
        );
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.insert("assessmentRows", {
              ...candidateRow.facts,
              index: 999,
              rowHash: candidateRow.rowHash,
              rowJson: candidateRow.rowJson,
              snapshotId: "candidate-snapshot-unactivated",
            })
          )
        );

        const activeDoc = yield* world.run(
          Effect.gen(function* () {
            const activeSnapshotId = yield* findActiveExplanationSnapshotId();
            return Option.getOrNull(
              yield* readExplanation({
                activeSnapshotId,
                fallbackSnapshotId: world.snapshotId,
                language: "id",
                versionHash,
              })
            );
          })
        );
        assert.ok(activeDoc, "Expected active explanation.");
        const encoded = yield* encodeDocument(activeDoc);
        expect(encoded).not.toContain("Pembahasan candidate yang belum aktif");
        expect(encoded).toContain("Pembahasan");

        // Even when the active snapshot deletes that explanation, candidate never leaks.
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const existing = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
                query
                  .eq("snapshotId", world.snapshotId)
                  .eq("kind", "explanation")
                  .eq("identity", `${versionHash}\0id`)
              )
              .unique();
            if (existing) {
              await ctx.db.delete("assessmentRows", existing._id);
            }
          })
        );
        const missing = yield* world.run(
          Effect.gen(function* () {
            const activeSnapshotId = yield* findActiveExplanationSnapshotId();
            return Option.getOrNull(
              yield* readExplanation({
                activeSnapshotId,
                fallbackSnapshotId: world.snapshotId,
                language: "id",
                versionHash,
              })
            );
          })
        );
        expect(missing).toBeNull();
      })
  );

  it.effect(
    "falls back to attemptSnapshotId when the active snapshot no longer holds that versionHash or when no snapshot is active",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const historicalSnapshotId = world.snapshotId;
        const seededRow = yield* Effect.promise(() =>
          world.t.query(async (ctx) => {
            const rows = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
                query
                  .eq("snapshotId", historicalSnapshotId)
                  .eq("kind", "explanation")
              )
              .collect();
            return Option.getOrNull(
              Arr.findFirst(rows, (row) => row.language === "id")
            );
          })
        );
        assert.ok(seededRow?.versionHash, "Expected a seeded explanation row.");
        const versionHash = seededRow.versionHash;

        // Replace with a new active snapshot and delete that version's explanation from the active snapshot.
        const next = yield* world.release({ renamed: true });
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const activeRow = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
                query
                  .eq("snapshotId", next.snapshotId)
                  .eq("kind", "explanation")
                  .eq("identity", `${versionHash}\0id`)
              )
              .unique();
            if (activeRow) {
              await ctx.db.delete("assessmentRows", activeRow._id);
            }
          })
        );

        const fallback = yield* world.run(
          Effect.map(
            readExplanation({
              activeSnapshotId: Option.some(next.snapshotId),
              fallbackSnapshotId: historicalSnapshotId,
              language: "id",
              versionHash,
            }),
            Option.getOrNull
          )
        );
        assert.ok(
          fallback,
          "Expected fallback explanation from historical snapshot."
        );
        expect(yield* encodeDocument(fallback)).toContain("Pembahasan");

        // When no active release exists, findActiveExplanationSnapshotId returns Option.none()
        // and readExplanation still falls back cleanly to historicalSnapshotId.
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const state = await ctx.db.query("contentState").unique();
            if (state) {
              await ctx.db.patch("contentState", state._id, {
                activeReleaseId: undefined,
              });
            }
          })
        );

        const noActiveResult = yield* world.run(
          Effect.gen(function* () {
            const activeSnapshotId = yield* findActiveExplanationSnapshotId();
            const fromHistorical = yield* readExplanation({
              activeSnapshotId,
              fallbackSnapshotId: historicalSnapshotId,
              language: "id",
              versionHash,
            });
            const withoutFallback = yield* readExplanation({
              activeSnapshotId,
              language: "id",
              versionHash,
            });
            return {
              activeSnapshotId: Option.getOrNull(activeSnapshotId),
              fromHistorical: Option.getOrNull(fromHistorical),
              withoutFallback: Option.getOrNull(withoutFallback),
            };
          })
        );
        expect(noActiveResult.activeSnapshotId).toBeNull();
        assert.ok(noActiveResult.fromHistorical);
        expect(noActiveResult.withoutFallback).toBeNull();
      })
  );
});

describe("tryouts/rows snapshot isolation", () => {
  it.effect(
    "reads item, key, and stimulus rows only from the requested snapshot and never leaks another snapshot",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const seeded = yield* Effect.promise(() =>
          world.t.query(async (ctx) => {
            const rows = await ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_index", (query) =>
                query.eq("snapshotId", world.snapshotId)
              )
              .collect();
            return {
              item: Option.getOrNull(
                Arr.findFirst(rows, (row) => row.kind === "item")
              ),
              key: Option.getOrNull(
                Arr.findFirst(rows, (row) => row.kind === "key")
              ),
              stimulus: Option.getOrNull(
                Arr.findFirst(rows, (row) => row.kind === "stimulus")
              ),
            };
          })
        );
        assert.ok(seeded.item?.versionHash);
        assert.ok(seeded.key?.versionHash);
        assert.ok(seeded.stimulus?.versionHash);
        const itemHash = seeded.item.versionHash;
        const keyHash = seeded.key.versionHash;
        const stimulusHash = seeded.stimulus.versionHash;

        // Insert broken rows with the same hashes under an unactivated candidate snapshot.
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            await ctx.db.insert("assessmentRows", {
              identity: "candidate-item",
              index: 1,
              kind: "item",
              rowHash: "sha256:0000",
              rowJson: "{}",
              snapshotId: "candidate-broken",
              versionHash: itemHash,
            });
            await ctx.db.insert("assessmentRows", {
              identity: keyHash,
              index: 2,
              kind: "key",
              rowHash: "sha256:0001",
              rowJson: "{}",
              snapshotId: "candidate-broken",
              versionHash: keyHash,
            });
            await ctx.db.insert("assessmentRows", {
              identity: "candidate-stimulus",
              index: 3,
              kind: "stimulus",
              rowHash: "sha256:0002",
              rowJson: "{}",
              snapshotId: "candidate-broken",
              versionHash: stimulusHash,
            });
          })
        );

        const good = yield* world.run(
          Effect.all({
            item: readItemVersion(world.snapshotId, itemHash),
            key: readItemKey(world.snapshotId, keyHash),
            stimulus: readStimulus(world.snapshotId, stimulusHash),
          })
        );
        expect(good.item.hash).toBe(itemHash);
        expect(good.key.version).toBe(keyHash);
        expect(good.stimulus.hash).toBe(stimulusHash);

        // Reading from the broken snapshot fails cleanly without leaking the active snapshot.
        expect(
          yield* world.run(
            readItemVersion("candidate-broken", itemHash).pipe(
              Effect.flip,
              Effect.map(({ code }) => ({ code }))
            )
          )
        ).toEqual({ code: "CONTENT_RELEASE_INTEGRITY" });
      })
  );
});
