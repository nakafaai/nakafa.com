import { assert, describe, expect, it } from "@effect/vitest";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { catalogNodeIdentity } from "@repo/backend/confect/tryouts/catalog/rows";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option } from "effect";

/** The stored text a row of another fixture snapshot holds, for a row of `kind` and `identity`. */
const otherRowText = (
  options: Parameters<typeof makeAssessmentTestSnapshot>[0],
  match: (text: string) => boolean
) =>
  Effect.map(makeAssessmentTestSnapshot(options), ({ rows }) => {
    const found = Arr.findFirst(
      Arr.map(rows, canonicalizeContentSnapshotRow),
      match
    );
    assert.ok(Option.isSome(found), "Expected the row in the other fixture.");
    return found.value;
  });

describe("tryouts/start/source", () => {
  it.effect(
    "refuses a set whose paper or profile the snapshot holds by another hash",
    () =>
      Effect.gen(function* () {
        const paperWorld = yield* tryoutWorld({ sets: 2 });
        yield* paperWorld.replaceRow(
          "paper",
          "test-paper-set-1",
          yield* otherRowText(
            { sets: 2 },
            (text) =>
              text.includes('"kind":"paper"') &&
              text.includes('"id":"test-paper-set-2"')
          )
        );
        expect(yield* paperWorld.start().pipe(Effect.flip)).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("names paper test-paper-set-1"),
        });
        const profileWorld = yield* tryoutWorld();
        yield* profileWorld.replaceRow(
          "profile",
          "test-profile",
          yield* otherRowText(
            {
              scoring: {
                kind: "penalized",
                marks: { blank: 0, correct: 4, wrong: -1 },
              },
            },
            (text) => text.includes('"kind":"profile"')
          )
        );
        expect(yield* profileWorld.start().pipe(Effect.flip)).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("names profile test-profile"),
        });
      })
  );

  it.effect(
    "refuses a snapshot that lost a row or cannot be frozen, and keeps no attempt",
    () =>
      Effect.gen(function* () {
        const missing = yield* tryoutWorld();
        yield* missing.replaceRow("paper", "test-paper-set-1", "");
        expect(yield* missing.start().pipe(Effect.flip)).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("holds no paper row"),
        });
        const broken = yield* tryoutWorld();
        yield* broken.replaceRow("paper", "test-paper-set-1", "{}");
        expect(yield* broken.start().pipe(Effect.flip)).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("not an assessment paper row"),
        });
        const unplaced = yield* tryoutWorld();
        yield* unplaced.replaceRow(
          "catalog",
          catalogNodeIdentity({
            appLocale: "id",
            countryKey: "indonesia",
            examKey: "snbt",
            kind: "section",
            sectionKey: "section-b",
            setKey: "set-1",
            trackKey: "2027",
          }),
          ""
        );
        expect(yield* unplaced.start().pipe(Effect.flip)).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("Section section-b"),
        });
        expect(
          yield* Effect.promise(() =>
            unplaced.t.query((ctx) => ctx.db.query("tryoutAttempts").collect())
          )
        ).toEqual([]);
      })
  );
});
