import { assert, describe, expect, it } from "@effect/vitest";
import type { AssessmentRowSchema } from "@nakafa/aksara-contracts/assessment/snapshot";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { LANDING_FEATURED_TRYOUT } from "@repo/backend/content/tryout/featured";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option, Schema } from "effect";

type AssessmentRow = typeof AssessmentRowSchema.Type;

const { getFeaturedQuestion } = tryouts.queries.catalog;

/** The fixture paper of the landing's set. */
const isFeaturedPaper = (row: AssessmentRow) =>
  row.kind === "paper" && row.paper.id === "test-paper-set-1";

/** The hash of the version the landing's set places first in the featured section. */
const featuredHash = (rows: readonly AssessmentRow[]) => {
  const place = Option.flatMap(Arr.findFirst(rows, isFeaturedPaper), (row) =>
    row.kind === "paper"
      ? Option.map(
          Arr.findFirst(
            row.paper.sections,
            ({ section }) => section === LANDING_FEATURED_TRYOUT.sectionKey
          ),
          ({ placements }) => Arr.headNonEmpty(placements).hash
        )
      : Option.none()
  );
  assert.ok(Option.isSome(place), "Expected the featured place.");
  return place.value;
};

/** A world whose first section is the landing's featured section. */
const featuredWorld = tryoutWorld({
  firstSectionKey: LANDING_FEATURED_TRYOUT.sectionKey,
});

describe("content/tryout/featured", () => {
  it.effect(
    "demonstrates the reading the featured version was written against",
    () =>
      Effect.gen(function* () {
        const world = yield* featuredWorld;
        yield* world.rewrite(
          (row, rows) =>
            row.kind === "item" && row.version.hash === featuredHash(rows),
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
        expect(
          yield* Schema.decodeEffect(TryoutQuestionBodyText)(question.body)
        ).toMatchObject({ stimulus: { type: "doc" } });
      })
  );

  it.effect(
    "refuses a release whose featured key has no answer for its version, or whose paper lost the section",
    () =>
      Effect.gen(function* () {
        const keyless = yield* featuredWorld;
        yield* keyless.rewrite(
          (row, rows) =>
            row.kind === "key" && row.key.version === featuredHash(rows),
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
        const unplaced = yield* featuredWorld;
        yield* unplaced.rewrite(isFeaturedPaper, (row) => {
          assert.ok(row.kind === "paper", "Expected the featured paper.");
          const [first, second, ...rest] = row.paper.sections;
          assert.ok(second, "Expected a second paper section.");
          // The featured section's places now sit under the second section's key.
          return {
            ...row,
            paper: {
              ...row.paper,
              sections: [{ ...first, section: second.section }, ...rest],
            },
          };
        });
        expect(
          yield* unplaced.visitor
            .query(getFeaturedQuestion, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({
          message: expect.stringContaining("featured question"),
        });
      })
  );
});
