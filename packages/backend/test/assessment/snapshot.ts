import { ItemExplanationSchema } from "@nakafa/aksara-contracts/assessment/explanation";
import {
  hashExamProfile,
  hashItemVersion,
  hashPaper,
  hashStimulusVersion,
} from "@nakafa/aksara-contracts/assessment/hash";
import type { StimulusReference } from "@nakafa/aksara-contracts/assessment/item";
import {
  ItemFamilySchema,
  ItemVersionBodySchema,
  ItemVersionSchema,
} from "@nakafa/aksara-contracts/assessment/item";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { ItemKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { PaperSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { ExamProfileSchema } from "@nakafa/aksara-contracts/assessment/profile";
import type { ScoringStrategy } from "@nakafa/aksara-contracts/assessment/scoring";
import type { AssessmentRow } from "@nakafa/aksara-contracts/assessment/snapshot";
import {
  StimulusVersionBodySchema,
  StimulusVersionSchema,
} from "@nakafa/aksara-contracts/assessment/stimulus";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  FIXTURE_TRACK,
  makeCatalog,
} from "@repo/backend/test/assessment/catalog";
import { Array as Arr, Effect, Schema } from "effect";

/** The app locales every fixture row is written in. */
const FIXTURE_LOCALES: readonly AppLocaleCode[] = ["id", "en", "de"];

const LOCALIZED = { de: "Prüfung", en: "Exam", id: "Ujian", ms: "Peperiksaan" };

/** One paragraph of text, the label or body of a fixture document. */
const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** How one fixture item asks and what its key holds. */
type ItemShape = "matrix" | "multiple" | "single";

/** The words of one fixture text in one language: Indonesian as written, any other language marked with its tag. */
const wordsIn = (text: string, language: string) =>
  language === "id" ? text : `${text} (${language})`;

/** The interaction and key of one fixture item by its shape, its words in `language`. */
const interactionOf = (shape: ItemShape, language: string) => {
  if (shape === "matrix") {
    return {
      interaction: {
        columns: [
          { id: "column-1", label: paragraph(wordsIn("Benar", language)) },
          { id: "column-2", label: paragraph(wordsIn("Salah", language)) },
        ],
        id: "matrix",
        kind: "matrix",
        label: "Jawaban",
        shuffle: false,
        statements: [
          {
            id: "statement-1",
            label: paragraph(wordsIn("Pernyataan satu", language)),
          },
          {
            id: "statement-2",
            label: paragraph(wordsIn("Pernyataan dua", language)),
          },
        ],
      },
      key: {
        answers: [
          { column: "column-1", statement: "statement-1" },
          { column: "column-2", statement: "statement-2" },
        ],
        interaction: "matrix",
        kind: "matrix",
      } satisfies InteractionKey,
    };
  }
  return {
    interaction: {
      id: "choice",
      kind: "choice",
      label: "Jawaban",
      maxChoices: shape === "single" ? 1 : 4,
      minChoices: 0,
      options: Arr.map(["A", "B", "C", "D"], (text, index) => ({
        id: `option-${index + 1}`,
        label: paragraph(wordsIn(text, language)),
      })),
      shuffle: false,
    },
    key: {
      correct: shape === "single" ? ["option-2"] : ["option-1", "option-3"],
      interaction: "choice",
      kind: "choice",
    } satisfies InteractionKey,
  };
};

/** Builds one item version in `language` with its key and explanations, each with its hash. */
const makeItem = Effect.fn("test.assessment.makeItem")(function* (
  family: string,
  shape: ItemShape,
  stimulus: StimulusReference | undefined,
  language: string
) {
  const { interaction, key } = interactionOf(shape, language);
  const body = yield* Schema.decodeUnknownEffect(ItemVersionBodySchema)({
    deliveryLanguage: language,
    family,
    ...(stimulus ? { stimulus } : {}),
    interactions: [interaction],
    prompt: {
      content: [
        {
          content: [
            { text: wordsIn(`Soal ${family}`, language), type: "text" },
          ],
          type: "paragraph",
        },
        { attrs: { interaction: interaction.id }, type: "interaction" },
      ],
      type: "doc",
    },
    scoring: [],
  });
  const version = yield* Schema.decodeEffect(ItemVersionSchema)({
    ...body,
    hash: yield* hashItemVersion(body),
  });
  return {
    explanations: yield* Effect.forEach(FIXTURE_LOCALES, (language) =>
      Schema.decodeEffect(ItemExplanationSchema)({
        document: paragraph(`Pembahasan ${family} ${language}`),
        language,
        version: version.hash,
      })
    ),
    family: yield* Schema.decodeEffect(ItemFamilySchema)({
      id: family,
      ...(stimulus ? { stimulus: stimulus.id } : {}),
    }),
    key: yield* Schema.decodeEffect(ItemKeySchema)({
      answers: [key],
      version: version.hash,
    }),
    version,
  };
});

/** The sections of the fixture profile, with the shapes of their items in paper order. */
const SECTIONS = [
  { id: "section-a", items: ["single", "multiple"], seconds: 600 },
  { id: "section-b", items: ["matrix"], seconds: 300 },
] as const;

/** The shared reading the table item is written against, in `language`. */
const makeReading = Effect.fn("test.assessment.makeReading")(function* (
  language: string
) {
  const body = yield* Schema.decodeEffect(StimulusVersionBodySchema)({
    deliveryLanguage: language,
    document: paragraph(wordsIn("Bacaan bersama", language)),
    id: "test/reading-1",
  });
  return yield* Schema.decodeEffect(StimulusVersionSchema)({
    ...body,
    hash: yield* hashStimulusVersion(body),
  });
});

/**
 * Builds one small, valid assessment snapshot: a profile of two sections; items that place a single
 * choice and a multiple choice in the first section and a table in the second, written against a
 * shared reading, every item's key and its explanations in every app locale; and a track of `sets` sets (one unless given), each with its
 * own paper over those items and its catalog from the country to each section in every app locale.
 * `scoring` is the profile's strategy (raw unless given), `entry` makes each set's one section an
 * internal entry, as a direct-entry set holds, `firstSectionKey` names the first section (`section-a`
 * unless given), `renamed` moves every set route, as a later release that renames them, and `languages`
 * writes every section in those languages, in that order (Indonesian unless given), each item and the
 * reading once per language. Every record carries its contract hash.
 */
export const makeAssessmentSnapshot = Effect.fn(
  "test.assessment.makeAssessmentSnapshot"
)(function* (
  options: {
    readonly entry?: boolean;
    readonly firstSectionKey?: string;
    readonly languages?: readonly [string, ...string[]];
    /** Adds a second track without sets to the fixture group, so the group opens its track cards. */
    readonly paired?: boolean;
    readonly renamed?: boolean;
    readonly scoring?: ScoringStrategy;
    readonly sets?: number;
  } = {}
) {
  const [first, second] = SECTIONS;
  const named = {
    ...first,
    id: options.firstSectionKey ?? first.id,
  };
  const sections = options.entry ? [named] : [named, second];
  const scoring = options.scoring ?? { kind: "raw" };
  const scaled = scoring.kind === "irt" || scoring.kind === "composite";
  const profile = yield* Schema.decodeUnknownEffect(ExamProfileSchema)({
    accommodations: { assigned: [], recorded: [], universal: [] },
    breaks: [],
    defaults: [
      { interaction: "choice", rule: { kind: "allOrNothing" } },
      { interaction: "matrix", rule: { kind: "allOrNothing" } },
    ],
    graceSeconds: 30,
    id: "test-profile",
    names: LOCALIZED,
    report: {
      sections: true,
      standardError: scoring.kind === "irt",
      total: true,
    },
    sampledMath: "score",
    ...(scaled ? { scale: { maximum: 1000, minimum: 0 } } : {}),
    scoring,
    sections: Arr.map(sections, (section) => ({
      id: section.id,
      interactions: ["choice", "matrix"],
      items: section.items.length,
      names: LOCALIZED,
      navigation: "free",
      seconds: section.seconds,
      tools: [],
    })),
    totalSeconds: Arr.reduce(
      sections,
      0,
      (total, { seconds }) => total + seconds
    ),
    writeAllowanceSeconds: 5,
  });
  const profileHash = yield* hashExamProfile(profile);
  const languages = options.languages ?? ["id"];
  const readings = yield* Effect.forEach(languages, makeReading);
  const items = yield* Effect.forEach(
    Arr.flatMap(sections, (section) =>
      Arr.flatMap(section.items, (shape, index) =>
        Arr.map(languages, (language, at) => ({
          family: `${section.id}-item-${index + 1}`,
          language,
          reading: readings[at],
          section: section.id,
          shape,
        }))
      )
    ),
    ({ family, language, reading, section, shape }) =>
      Effect.map(
        makeItem(
          family,
          shape,
          shape === "matrix" && reading !== undefined
            ? { hash: reading.hash, id: reading.id }
            : undefined,
          language
        ),
        (item) => ({ ...item, section })
      )
  );
  const stimuli = Arr.filter(readings, (reading) =>
    Arr.some(items, ({ version }) => version.stimulus?.hash === reading.hash)
  );
  /** Each item family once, as its first language's version names it. */
  const families = Arr.dedupeWith(
    items,
    (left, right) => left.family.id === right.family.id
  );
  const sets = yield* Effect.forEach(
    Arr.makeBy(options.sets ?? 1, (index) => `set-${index + 1}`),
    (setKey) =>
      Effect.gen(function* () {
        const paper = yield* Schema.decodeUnknownEffect(PaperSchema)({
          id: `test-paper-${setKey}`,
          profile: { hash: profileHash, id: profile.id },
          sections: Arr.map(sections, (section) => ({
            languages,
            placements: Arr.map(
              Arr.filter(families, (item) => item.section === section.id),
              ({ family }) => ({
                family: family.id,
                versions: Arr.map(
                  Arr.filter(items, (item) => item.family.id === family.id),
                  ({ version }) => ({
                    hash: version.hash,
                    language: version.deliveryLanguage,
                  })
                ),
              })
            ),
            section: section.id,
          })),
          stimuli: Arr.map(stimuli, ({ hash, id }) => ({ hash, id })),
        });
        return {
          identity: `${FIXTURE_TRACK.countryKey}/${FIXTURE_TRACK.examKey}/${FIXTURE_TRACK.trackKey}/${setKey}`,
          key: setKey,
          paper,
          paperHash: yield* hashPaper(paper),
        };
      })
  );
  const catalog = Arr.flatMap(FIXTURE_LOCALES, (appLocale) =>
    makeCatalog(appLocale, {
      entry: options.entry === true,
      paired: options.paired === true,
      renamed: options.renamed === true,
      sections: Arr.map(sections, ({ id }) => id),
      sets: Arr.map(sets, ({ key, paper, paperHash }) => ({
        paper: { hash: paperHash, id: paper.id },
        setKey: key,
      })),
    })
  );
  const rows: AssessmentRow[] = [
    ...Arr.map(catalog, (row) => ({ kind: "catalog" as const, row })),
    { hash: profileHash, kind: "profile", profile },
    ...Arr.map(sets, ({ paper, paperHash }) => ({
      hash: paperHash,
      kind: "paper" as const,
      paper,
    })),
    ...Arr.map(stimuli, (version) => ({ kind: "stimulus" as const, version })),
    ...Arr.map(families, ({ family }) => ({
      family,
      kind: "family" as const,
    })),
    ...Arr.map(items, ({ version }) => ({ kind: "item" as const, version })),
    ...Arr.map(items, ({ key }) => ({ key, kind: "key" as const })),
    ...Arr.flatMap(items, ({ explanations }) =>
      Arr.map(explanations, (explanation) => ({
        explanation,
        kind: "explanation" as const,
      }))
    ),
  ];
  return { catalog, items, profile, profileHash, rows, sets };
});
