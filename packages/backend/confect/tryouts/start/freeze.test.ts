import { assert, describe, expect, it } from "@effect/vitest";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import {
  freezeAttempt,
  PlacedItem,
} from "@repo/backend/confect/tryouts/start/freeze";
import { makeAssessmentSnapshot } from "@repo/backend/test/assessment/snapshot";
import { Array as Arr, Effect, Schema } from "effect";

/** The parts of a fixture snapshot that an attempt of its first set freezes from. */
const sourceOf = (
  snapshot: Effect.Success<ReturnType<typeof makeAssessmentSnapshot>>
) => {
  const [set] = snapshot.sets;
  assert(set);
  return {
    items: Arr.map(snapshot.items, ({ key, version }) => ({ key, version })),
    paper: set.paper,
    profile: snapshot.profile,
    sections: Arr.flatMap(snapshot.catalog, (row) =>
      row.kind === "section" && row.appLocale === "id" ? [row] : []
    ),
  };
};

describe("tryouts/start/freeze", () => {
  it.effect(
    "freezes the profile's sections with their catalog order, paper places, and time limits, and numbers each section from 1",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot();
        const { placements, sections } = yield* freezeAttempt(
          sourceOf(snapshot)
        );
        expect(sections).toEqual([
          {
            publicPath: "try-out/indonesia/snbt/2027/set-1-id/section-a",
            questionCount: 2,
            sectionKey: "section-a",
            sectionOrder: 1,
            timeLimitSeconds: 600,
          },
          {
            publicPath: "try-out/indonesia/snbt/2027/set-1-id/section-b",
            questionCount: 1,
            sectionKey: "section-b",
            sectionOrder: 2,
            timeLimitSeconds: 300,
          },
        ]);
        expect(
          Arr.map(placements, ({ questionOrder, sectionKey }) => [
            sectionKey,
            questionOrder,
          ])
        ).toEqual([
          ["section-a", 1],
          ["section-a", 2],
          ["section-b", 1],
        ]);
      })
  );

  it.effect(
    "freezes each place's version, interaction, key answer, and the profile's default rule for its kind",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot();
        const { placements } = yield* freezeAttempt(sourceOf(snapshot));
        const [first] = snapshot.items;
        const [placed] = placements;
        assert(first && placed);
        expect(placed).toMatchObject({
          deliveryLanguage: "id",
          family: first.version.family,
          questionOrder: 1,
          sectionKey: "section-a",
          versionHash: first.version.hash,
        });
        expect(yield* readPlacedQuestion(placed)).toEqual({
          interaction: first.version.interactions[0],
          key: first.key.answers[0],
          rule: { kind: "allOrNothing" },
        });
      })
  );

  it.effect(
    "freezes a direct-entry set's section without a public path, entered from its set",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot({ entry: true });
        const { sections } = yield* freezeAttempt(sourceOf(snapshot));
        expect(sections).toEqual([
          {
            questionCount: 2,
            sectionKey: "section-a",
            sectionOrder: 1,
            timeLimitSeconds: 600,
          },
        ]);
      })
  );

  it.effect(
    "takes an item's own rule for its interaction over the profile's default",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot();
        const source = sourceOf(snapshot);
        const perPart = {
          floor: 0,
          kind: "perPart",
          pointsPerPart: 2,
        } as const;
        const items = Arr.map(source.items, (item, index) =>
          index === 1
            ? {
                ...item,
                version: {
                  ...item.version,
                  scoring: [{ interaction: "choice", rule: perPart }],
                },
              }
            : item
        );
        const { placements } = yield* freezeAttempt({ ...source, items });
        expect(placements[1]?.rule).toEqual(perPart);
      })
  );

  it.effect(
    "refuses a section without its paper section, a place without its item, a version of two interactions, a key without the answer, and a kind without a rule",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot();
        const source = sourceOf(snapshot);
        const codeOf = (input: typeof source) =>
          freezeAttempt(input).pipe(
            Effect.flip,
            Effect.map(({ code }) => code)
          );
        expect(
          yield* codeOf({ ...source, sections: Arr.take(source.sections, 1) })
        ).toBe("TRYOUT_SECTION_UNPLACED");
        expect(
          yield* codeOf({ ...source, items: Arr.drop(source.items, 1) })
        ).toBe("TRYOUT_ITEM_MISSING");
        const [first] = source.items;
        assert(first);
        const twice = yield* Schema.decodeEffect(PlacedItem)({
          ...first,
          version: {
            ...first.version,
            interactions: [
              ...first.version.interactions,
              { ...first.version.interactions[0], id: "second" },
            ],
            prompt: {
              ...first.version.prompt,
              content: [
                ...first.version.prompt.content,
                { attrs: { interaction: "second" }, type: "interaction" },
              ],
            },
          },
        });
        expect(
          yield* codeOf({
            ...source,
            items: [twice, ...Arr.drop(source.items, 1)],
          })
        ).toBe("TRYOUT_ITEM_SHAPE");
        const keyless = yield* Schema.decodeEffect(PlacedItem)({
          ...first,
          key: {
            ...first.key,
            answers: [{ ...first.key.answers[0], interaction: "other" }],
          },
        });
        expect(
          yield* codeOf({
            ...source,
            items: [keyless, ...Arr.drop(source.items, 1)],
          })
        ).toBe("TRYOUT_KEY_MISSING");
        expect(
          yield* codeOf({
            ...source,
            profile: { ...source.profile, defaults: [] },
          })
        ).toBe("TRYOUT_RULE_MISSING");
      })
  );
});
