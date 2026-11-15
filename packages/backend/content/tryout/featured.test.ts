import { assert, describe, expect, it } from "@effect/vitest";
import type { AssessmentRowSchema } from "@nakafa/aksara-contracts/assessment/snapshot";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option, Schema } from "effect";

type AssessmentRow = typeof AssessmentRowSchema.Type;

const { getFeaturedQuestion } = tryouts.queries.catalog;

/** Selects the fixture paper of one set. */
const isPaperOf = (setKey: string) => (row: AssessmentRow) =>
  row.kind === "paper" && row.paper.id === `test-paper-${setKey}`;

/** The hash of the version a set's paper places first in its first section. */
const firstPlaceHash = (rows: readonly AssessmentRow[], setKey: string) => {
  const place = Option.flatMap(Arr.findFirst(rows, isPaperOf(setKey)), (row) =>
    row.kind === "paper"
      ? Option.map(
          Arr.head(row.paper.sections),
          ({ placements }) =>
            Arr.headNonEmpty(Arr.headNonEmpty(placements).versions).hash
        )
      : Option.none()
  );
  assert.ok(Option.isSome(place), "Expected the first place.");
  return place.value;
};

/** Selects one catalog row of one kind in one app locale. */
const isCatalogRow =
  (kind: string, appLocale: string) => (row: AssessmentRow) =>
    row.kind === "catalog" &&
    row.row.kind === kind &&
    row.row.appLocale === appLocale;

describe("content/tryout/featured", () => {
  it.effect(
    "demonstrates the first place of the first set the catalog lists, with its reading",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* world.rewrite(
          (row, rows) =>
            row.kind === "item" &&
            row.version.hash === firstPlaceHash(rows, "set-1"),
          (row, rows) => {
            const read = Arr.findFirst(
              rows,
              (candidate) =>
                candidate.kind === "item" &&
                candidate.version.stimulus !== undefined
            );
            assert.ok(
              row.kind === "item" &&
                Option.isSome(read) &&
                read.value.kind === "item",
              "Expected the featured item and an item with a reading."
            );
            const { stimulus } = read.value.version;
            assert.ok(stimulus, "Expected the reading.");
            return { ...row, version: { ...row.version, stimulus } };
          }
        );
        const question = yield* world.visitor.query(getFeaturedQuestion, {
          appLocale: "id",
        });
        assert.ok(question.kind === "question", "Expected a question.");
        expect(
          yield* Schema.decodeEffect(TryoutQuestionBodyText)(question.body)
        ).toMatchObject({ stimulus: { type: "doc" } });
      })
  );

  it.effect("follows the catalog's order to the set it lists first", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld({ sets: 2 });
      let second = "";
      yield* world.rewrite(isCatalogRow("set", "en"), (row, rows) => {
        second = firstPlaceHash(rows, "set-2");
        assert.ok(
          row.kind === "catalog" && row.row.kind === "set",
          "Expected the first set's catalog row."
        );
        // The first set now comes after the second.
        return { ...row, row: { ...row.row, order: 3 } };
      });
      expect(
        yield* world.visitor.query(getFeaturedQuestion, { appLocale: "en" })
      ).toMatchObject({ kind: "question", versionHash: second });
    })
  );

  it.effect("demonstrates none in a locale whose catalog serves no set", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      // The fixture's sets are not written in Malay.
      expect(
        yield* world.visitor.query(getFeaturedQuestion, { appLocale: "ms" })
      ).toEqual({ kind: "none" });
    })
  );

  it.effect(
    "refuses a catalog whose set lost its track or a node above it",
    () =>
      Effect.gen(function* () {
        const trackless = yield* tryoutWorld();
        yield* trackless.rewrite(isCatalogRow("track", "id"), (row) => {
          assert.ok(
            row.kind === "catalog" && row.row.kind === "track",
            "Expected the track."
          );
          return { ...row, row: { ...row.row, trackKey: "elsewhere" } };
        });
        expect(
          yield* trackless.visitor
            .query(getFeaturedQuestion, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("featured track"),
        });
        const countryless = yield* tryoutWorld();
        yield* countryless.rewrite(isCatalogRow("country", "id"), (row) => {
          assert.ok(
            row.kind === "catalog" && row.row.kind === "country",
            "Expected the country."
          );
          return { ...row, row: { ...row.row, countryKey: "elsewhere" } };
        });
        expect(
          yield* countryless.visitor
            .query(getFeaturedQuestion, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("featured country"),
        });
      })
  );

  it.effect(
    "refuses a release whose featured key has no answer for its version",
    () =>
      Effect.gen(function* () {
        const keyless = yield* tryoutWorld();
        yield* keyless.rewrite(
          (row, rows) =>
            row.kind === "key" &&
            row.key.version === firstPlaceHash(rows, "set-1"),
          (row, rows) => {
            const other = Arr.findFirst(
              rows,
              (candidate) =>
                candidate.kind === "key" &&
                Arr.some(candidate.key.answers, ({ kind }) => kind === "matrix")
            );
            assert.ok(Option.isSome(other), "Expected the table's key.");
            assert.ok(row.kind === "key", "Expected the featured key.");
            return other.value;
          }
        );
        expect(
          yield* keyless.visitor
            .query(getFeaturedQuestion, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("featured answer"),
        });
      })
  );
});
