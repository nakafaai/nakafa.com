import { assert, describe, expect, it } from "@effect/vitest";
import { QUESTION_PARTS_MAX } from "@repo/backend/confect/assessment/parts";
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

/**
 * An item of `count` parts, as Aksara publishes an exam task: part `a` a typed number, every later part a typed
 * text, each placed in its prompt and scored per part with points rising by its place.
 */
const partsItem = (
  item: PlacedItem,
  count: number
): typeof PlacedItem.Encoded => {
  const ids = Arr.makeBy(count, (index) =>
    index === 0 ? "part-a" : `part-b${index === 1 ? "" : `-${index}`}`
  );
  return {
    key: {
      ...item.key,
      answers: Arr.map(ids, (id, index) =>
        index === 0
          ? { interaction: id, kind: "numericEntry" as const, value: "2" }
          : {
              accepted: {
                acceptedAnswers: ["Haus"],
                collapseWhitespace: true,
                ignoreCase: false,
                kind: "text" as const,
              },
              interaction: id,
              kind: "textEntry" as const,
            }
      ),
    },
    version: {
      ...item.version,
      interactions: Arr.map(ids, (id, index) =>
        index === 0
          ? {
              acceptsFractions: false,
              id,
              kind: "numericEntry" as const,
              label: "Antwort a",
            }
          : { id, kind: "textEntry" as const, label: `Antwort ${id}` }
      ),
      prompt: {
        content: [
          { content: [{ text: "Rechne.", type: "text" }], type: "paragraph" },
          ...Arr.map(ids, (id) => ({
            attrs: { interaction: id },
            type: "interaction",
          })),
        ],
        type: "doc",
      },
      scoring: Arr.map(ids, (id, index) => ({
        interaction: id,
        rule: { floor: 0, kind: "perPart" as const, pointsPerPart: index + 1 },
      })),
    },
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
            languages: ["id"],
            publicPath: "try-out/indonesia/snbt/2027/utbk/set-1-id/section-a",
            questionCount: 2,
            sectionKey: "section-a",
            sectionOrder: 1,
            timeLimitSeconds: 600,
          },
          {
            languages: ["id"],
            publicPath: "try-out/indonesia/snbt/2027/utbk/set-1-id/section-b",
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
    "freezes each place's version in every language of its section, the structure of its interaction without words, its key answer, and the profile's default rule",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot({
          languages: ["ms", "en"],
        });
        const { placements, sections } = yield* freezeAttempt(
          sourceOf(snapshot)
        );
        const [malay, english] = snapshot.items;
        const [placed] = placements;
        assert(malay && english && placed);
        expect(Arr.map(sections, ({ languages }) => languages)).toEqual([
          ["ms", "en"],
          ["ms", "en"],
        ]);
        expect(placed).toMatchObject({
          family: malay.version.family,
          questionOrder: 1,
          sectionKey: "section-a",
          versions: [
            { hash: malay.version.hash, language: "ms" },
            { hash: english.version.hash, language: "en" },
          ],
        });
        expect(yield* readPlacedQuestion(placed)).toEqual({
          interactions: [
            {
              interaction: {
                id: "choice",
                kind: "choice",
                maxChoices: 1,
                minChoices: 0,
                options: [
                  { id: "option-1" },
                  { id: "option-2" },
                  { id: "option-3" },
                  { id: "option-4" },
                ],
                shuffle: false,
              },
              key: malay.key.answers[0],
              rule: { kind: "allOrNothing" },
            },
          ],
        });
        expect(placed.interactionJson).not.toContain("label");
        expect(placed).not.toHaveProperty("laterInteractions");
      })
  );

  it.effect(
    "accepts the typed answers of every language of a place, so a switch never changes a grade",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot({
          languages: ["ms", "en"],
        });
        const source = sourceOf(snapshot);
        const textIn = (accepted: readonly [string, ...string[]]) => ({
          accepted: {
            acceptedAnswers: accepted,
            collapseWhitespace: true,
            ignoreCase: true,
            kind: "text" as const,
          },
          interaction: "choice",
          kind: "textEntry" as const,
        });
        const typed = {
          id: "choice",
          kind: "textEntry",
          label: "Jawapan",
        } as const;
        const accepted: readonly (readonly [string, ...string[]])[] = [
          ["tiga", "3"],
          ["three", "3"],
        ];
        const items = Arr.map(source.items, (item, index) =>
          index < 2
            ? {
                key: {
                  ...item.key,
                  answers: Arr.of(textIn(accepted[index] ?? ["3"])),
                },
                version: {
                  ...item.version,
                  interactions: Arr.of(typed),
                  scoring: [
                    {
                      interaction: "choice",
                      rule: { kind: "allOrNothing" as const },
                    },
                  ],
                },
              }
            : item
        );
        const { placements } = yield* freezeAttempt({ ...source, items });
        const [placed] = placements;
        assert(placed);
        expect((yield* readPlacedQuestion(placed)).interactions[0].key).toEqual(
          textIn(["tiga", "3", "three"])
        );
        // A version whose answer is no text entry adds no text to the first's.
        const mixed = Arr.map(items, (item, index) =>
          index === 1 ? (source.items[1] ?? item) : item
        );
        const [alone] = (yield* freezeAttempt({ ...source, items: mixed }))
          .placements;
        assert(alone);
        expect((yield* readPlacedQuestion(alone)).interactions[0].key).toEqual(
          textIn(["tiga", "3"])
        );
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
            languages: ["id"],
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
    "freezes every interaction of a question of several parts in the item's order, each with its key answer and its own rule",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeAssessmentSnapshot();
        const source = sourceOf(snapshot);
        const [first] = source.items;
        assert(first);
        const parts = yield* Schema.decodeEffect(PlacedItem)(
          partsItem(first, 2)
        );
        const { placements } = yield* freezeAttempt({
          ...source,
          items: [parts, ...Arr.drop(source.items, 1)],
        });
        const [placed] = placements;
        assert(placed);
        const question = yield* readPlacedQuestion(placed);
        expect(
          Arr.map(question.interactions, ({ interaction, key, rule }) => [
            interaction,
            key.kind,
            rule,
          ])
        ).toEqual([
          [
            { acceptsFractions: false, id: "part-a", kind: "numericEntry" },
            "numericEntry",
            { floor: 0, kind: "perPart", pointsPerPart: 1 },
          ],
          [
            { id: "part-b", kind: "textEntry" },
            "textEntry",
            { floor: 0, kind: "perPart", pointsPerPart: 2 },
          ],
        ]);
        expect(placed.laterInteractions).toHaveLength(1);
      })
  );

  it.effect(
    "refuses a section without its paper section, a place without its item, a version of more parts than a question holds or of one joint rule, a key without the answer, and a kind without a rule",
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
        const crowded = yield* Schema.decodeEffect(PlacedItem)(
          partsItem(first, QUESTION_PARTS_MAX + 1)
        );
        expect(
          yield* codeOf({
            ...source,
            items: [crowded, ...Arr.drop(source.items, 1)],
          })
        ).toBe("TRYOUT_ITEM_SHAPE");
        const pair = partsItem(first, 2);
        const joint = yield* Schema.decodeEffect(PlacedItem)({
          ...pair,
          version: {
            ...pair.version,
            joint: { levels: [{ correct: ["part-a", "part-b"], points: 2 }] },
            scoring: [],
          },
        });
        expect(
          yield* codeOf({
            ...source,
            items: [joint, ...Arr.drop(source.items, 1)],
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
