import {
  type CatalogRow,
  CatalogRowSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { ItemExplanationSchema } from "@nakafa/aksara-contracts/assessment/explanation";
import {
  hashExamProfile,
  hashItemVersion,
  hashPaper,
  hashStimulusVersion,
} from "@nakafa/aksara-contracts/assessment/hash";
import {
  ItemFamilySchema,
  ItemVersionBodySchema,
  ItemVersionSchema,
  type StimulusReference,
} from "@nakafa/aksara-contracts/assessment/item";
import {
  type InteractionKey,
  ItemKeySchema,
} from "@nakafa/aksara-contracts/assessment/key";
import { PaperSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { ExamProfileSchema } from "@nakafa/aksara-contracts/assessment/profile";
import type { ScoringStrategy } from "@nakafa/aksara-contracts/assessment/scoring";
import type { AssessmentRow } from "@nakafa/aksara-contracts/assessment/snapshot";
import {
  StimulusVersionBodySchema,
  StimulusVersionSchema,
} from "@nakafa/aksara-contracts/assessment/stimulus";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Schema } from "effect";

/** One localized set row of a catalog. */
type CatalogSet = Extract<CatalogRow, { readonly kind: "set" }>;

/** The app locales every fixture row is written in. */
const FIXTURE_LOCALES: readonly AppLocaleCode[] = ["id", "en", "de"];

/** The source revision of every fixture catalog row: an authored date, as the contract keeps a catalog revision. */
export const FIXTURE_REVISION = "2026-10-02";

/** The keys of the fixture track, which every fixture set belongs to. */
export const FIXTURE_TRACK = {
  countryKey: "indonesia",
  examKey: "snbt",
  trackKey: "2027",
};

const LOCALIZED = { de: "Prüfung", en: "Exam", id: "Ujian" };

/** One paragraph of text, the label or body of a fixture document. */
const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** The learning-graph identity of one fixture node in one app locale, owned by the try-out family. */
const graph = (appLocale: AppLocaleCode, name: string) => ({
  alignmentId: `alignment:tryout:${name}`,
  assetId: `asset:${appLocale}:tryout:${name}`,
  conceptId: `concept:tryout:${name}`,
  learningObjectId: `lo:tryout:${name}`,
  lensId: `lens:tryout:${name}`,
});

/** How one fixture item asks and what its key holds. */
type ItemShape = "matrix" | "multiple" | "single";

/** The interaction and key of one fixture item by its shape. */
const interactionOf = (shape: ItemShape) => {
  if (shape === "matrix") {
    return {
      interaction: {
        columns: [
          { id: "column-1", label: paragraph("Benar") },
          { id: "column-2", label: paragraph("Salah") },
        ],
        id: "matrix",
        kind: "matrix",
        label: "Jawaban",
        shuffle: false,
        statements: [
          { id: "statement-1", label: paragraph("Pernyataan satu") },
          { id: "statement-2", label: paragraph("Pernyataan dua") },
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
        label: paragraph(text),
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

/** Builds one item version in Indonesian with its key, family, and explanations, each with its hash. */
const makeItem = Effect.fn("test.assessment.makeItem")(function* (
  family: string,
  shape: ItemShape,
  stimulus: StimulusReference | undefined
) {
  const { interaction, key } = interactionOf(shape);
  const body = yield* Schema.decodeUnknownEffect(ItemVersionBodySchema)({
    deliveryLanguage: "id",
    family,
    ...(stimulus ? { stimulus } : {}),
    interactions: [interaction],
    prompt: {
      content: [
        {
          content: [{ text: `Soal ${family}`, type: "text" }],
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

/** The shared reading the table item is written against, in Indonesian. */
const makeReading = Effect.fn("test.assessment.makeReading")(function* () {
  const body = yield* Schema.decodeEffect(StimulusVersionBodySchema)({
    deliveryLanguage: "id",
    document: paragraph("Bacaan bersama"),
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
 * unless given), and `renamed` moves every set route, as a later release that renames them. Every record carries its contract hash.
 */
export const makeAssessmentSnapshot = Effect.fn(
  "test.assessment.makeAssessmentSnapshot"
)(function* (
  options: {
    readonly entry?: boolean;
    readonly firstSectionKey?: string;
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
  const reading = yield* makeReading();
  const items = yield* Effect.forEach(
    Arr.flatMap(sections, (section) =>
      Arr.map(section.items, (shape, index) => ({
        family: `${section.id}-item-${index + 1}`,
        section: section.id,
        shape,
      }))
    ),
    ({ family, section, shape }) =>
      Effect.map(
        makeItem(
          family,
          shape,
          shape === "matrix"
            ? { hash: reading.hash, id: reading.id }
            : undefined
        ),
        (item) => ({ ...item, section })
      )
  );
  const stimuli = Arr.some(
    items,
    ({ version }) => version.stimulus !== undefined
  )
    ? [reading]
    : [];
  const sets = yield* Effect.forEach(
    Arr.makeBy(options.sets ?? 1, (index) => `set-${index + 1}`),
    (setKey) =>
      Effect.gen(function* () {
        const paper = yield* Schema.decodeUnknownEffect(PaperSchema)({
          id: `test-paper-${setKey}`,
          profile: { hash: profileHash, id: profile.id },
          sections: Arr.map(sections, (section) => ({
            placements: Arr.map(
              Arr.filter(items, (item) => item.section === section.id),
              ({ version }) => ({ family: version.family, hash: version.hash })
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
    ...Arr.map(items, ({ family }) => ({ family, kind: "family" as const })),
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

/** The route of one fixture set in one app locale. */
export function fixtureSetPath(
  setKey: string,
  appLocale: AppLocaleCode,
  renamed = false
) {
  return `try-out/indonesia/snbt/2027/${setKey}${renamed ? "-renamed" : ""}-${appLocale}`;
}

/** The catalog of one app locale: the country, the exam, the track, and each set with its sections. */
function makeCatalog(
  appLocale: AppLocaleCode,
  track: {
    readonly entry: boolean;
    readonly renamed: boolean;
    readonly sections: readonly string[];
    readonly sets: readonly Pick<CatalogSet, "paper" | "setKey">[];
  }
): CatalogRow[] {
  const base = {
    appLocale,
    // Aksara writes the commit of the source tree, which the web links to.
    sourceRevision: FIXTURE_REVISION,
    title: "Try-out",
  };
  return Arr.map(
    [
      {
        ...base,
        countryCode: "ID",
        countryKey: FIXTURE_TRACK.countryKey,
        description: "Try-out Indonesia",
        graph: graph(appLocale, "country"),
        kind: "country",
        order: 1,
        publicPath: `try-out/indonesia-${appLocale}`,
      },
      {
        ...base,
        countryKey: FIXTURE_TRACK.countryKey,
        examKey: FIXTURE_TRACK.examKey,
        graph: graph(appLocale, "exam"),
        kind: "exam",
        order: 1,
        publicPath: `try-out/indonesia/snbt-${appLocale}`,
      },
      {
        ...base,
        ...FIXTURE_TRACK,
        graph: graph(appLocale, "track"),
        kind: "track",
        order: 1,
        publicPath: `try-out/indonesia/snbt/2027-${appLocale}`,
        trackKind: "year",
      },
      ...Arr.flatMap(track.sets, (set, setIndex) => {
        const setPath = fixtureSetPath(set.setKey, appLocale, track.renamed);
        const keys = { ...FIXTURE_TRACK, setKey: set.setKey };
        return [
          {
            ...base,
            ...keys,
            graph: graph(appLocale, set.setKey),
            ...(track.entry
              ? { internalEntrySectionKey: track.sections[0] }
              : {}),
            kind: "set",
            order: setIndex + 1,
            paper: set.paper,
            publicPath: setPath,
          },
          ...Arr.map(track.sections, (sectionKey, index) => ({
            ...base,
            ...keys,
            graph: graph(appLocale, `${set.setKey}-${sectionKey}`),
            kind: "section",
            order: index + 1,
            ...(track.entry
              ? { visibility: "internal-entry" }
              : {
                  publicPath: `${setPath}/${sectionKey}`,
                  visibility: "visible",
                }),
            sectionKey,
          })),
        ];
      }),
    ],
    (row) => Schema.decodeUnknownSync(CatalogRowSchema)(row)
  );
}
