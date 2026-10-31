import {
  type CatalogRow,
  CatalogRowSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { ItemExplanationSchema } from "@nakafa/aksara-contracts/assessment/explanation";
import {
  hashExamProfile,
  hashItemVersion,
  hashPaper,
} from "@nakafa/aksara-contracts/assessment/hash";
import {
  ItemFamilySchema,
  ItemVersionBodySchema,
  ItemVersionSchema,
} from "@nakafa/aksara-contracts/assessment/item";
import {
  type InteractionKey,
  ItemKeySchema,
} from "@nakafa/aksara-contracts/assessment/key";
import { PaperSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { ExamProfileSchema } from "@nakafa/aksara-contracts/assessment/profile";
import type { ScoringStrategy } from "@nakafa/aksara-contracts/assessment/scoring";
import type { AssessmentRow } from "@nakafa/aksara-contracts/assessment/snapshot";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Schema } from "effect";

/** The app locales every fixture row is written in. */
export const FIXTURE_LOCALES: readonly AppLocaleCode[] = ["id", "en", "de"];

const LOCALIZED = { de: "Prüfung", en: "Exam", id: "Ujian" };

/** One paragraph of text, the label or body of a fixture document. */
const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** The graph identity of one fixture node. */
const graph = (name: string) => ({
  alignmentId: `alignment:${name}`,
  assetId: `asset:${name}`,
  conceptId: `concept:${name}`,
  learningObjectId: `lo:${name}`,
  lensId: `lens:${name}`,
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
  shape: ItemShape
) {
  const { interaction, key } = interactionOf(shape);
  const body = yield* Schema.decodeUnknownEffect(ItemVersionBodySchema)({
    deliveryLanguage: "id",
    family,
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
  const version = ItemVersionSchema.make({
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
    family: yield* Schema.decodeEffect(ItemFamilySchema)({ id: family }),
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
] as const satisfies readonly {
  id: string;
  items: readonly ItemShape[];
  seconds: number;
}[];

/**
 * Builds one small, valid assessment snapshot: a profile of two sections, a paper that places a
 * single choice and a multiple choice in the first and a table in the second, every item's key and
 * its explanations in every app locale, and the catalog from the country to each section in every
 * app locale. `scoring` is the profile's strategy (raw unless given), and `entry` makes the set's one
 * section an internal entry, as a direct-entry set holds. Every record carries its contract hash.
 */
export const makeAssessmentSnapshot = Effect.fn(
  "test.assessment.makeAssessmentSnapshot"
)(function* (
  options: { readonly entry?: boolean; readonly scoring?: ScoringStrategy } = {}
) {
  const sections = options.entry ? [SECTIONS[0]] : SECTIONS;
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
  const items = yield* Effect.forEach(
    Arr.flatMap(sections, (section) =>
      Arr.map(section.items, (shape, index) => ({
        family: `${section.id}-item-${index + 1}`,
        section: section.id,
        shape,
      }))
    ),
    ({ family, section, shape }) =>
      Effect.map(makeItem(family, shape), (item) => ({ ...item, section }))
  );
  const paper = yield* Schema.decodeUnknownEffect(PaperSchema)({
    id: "test-paper",
    profile: { hash: profileHash, id: profile.id },
    sections: Arr.map(sections, (section) => ({
      placements: Arr.map(
        Arr.filter(items, (item) => item.section === section.id),
        ({ version }) => ({ family: version.family, hash: version.hash })
      ),
      section: section.id,
    })),
    stimuli: [],
  });
  const paperHash = yield* hashPaper(paper);
  const catalog = Arr.flatMap(FIXTURE_LOCALES, (appLocale) =>
    makeCatalog(appLocale, {
      entry: options.entry === true,
      paper: { hash: paperHash, id: paper.id },
      sections: Arr.map(sections, ({ id }) => id),
    })
  );
  const rows: AssessmentRow[] = [
    ...Arr.map(catalog, (row) => ({ kind: "catalog" as const, row })),
    { hash: profileHash, kind: "profile", profile },
    { hash: paperHash, kind: "paper", paper },
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
  return {
    catalog,
    items,
    paper,
    paperHash,
    profile,
    profileHash,
    rows,
    setIdentity: "indonesia/snbt/2027/set-1",
  };
});

/** The catalog of one app locale: the country, the exam, the track, the set, and its sections. */
function makeCatalog(
  appLocale: AppLocaleCode,
  set: {
    readonly entry: boolean;
    readonly paper: { readonly hash: string; readonly id: string };
    readonly sections: readonly string[];
  }
): CatalogRow[] {
  const base = {
    appLocale,
    sourceRevision: "test-revision",
    title: "Try-out",
  };
  const keys = {
    countryKey: "indonesia",
    examKey: "snbt",
    setKey: "set-1",
    trackKey: "2027",
  };
  const setPath = `try-out/indonesia/snbt/2027/set-1-${appLocale}`;
  return Arr.map(
    [
      {
        ...base,
        countryCode: "ID",
        countryKey: keys.countryKey,
        graph: graph("country"),
        kind: "country",
        order: 1,
        publicPath: `try-out/indonesia-${appLocale}`,
      },
      {
        ...base,
        countryKey: keys.countryKey,
        examKey: keys.examKey,
        graph: graph("exam"),
        kind: "exam",
        order: 1,
        publicPath: `try-out/indonesia/snbt-${appLocale}`,
      },
      {
        ...base,
        ...keys,
        graph: graph("track"),
        kind: "track",
        order: 1,
        publicPath: `try-out/indonesia/snbt/2027-${appLocale}`,
        trackKind: "year",
      },
      {
        ...base,
        ...keys,
        graph: graph("set"),
        ...(set.entry ? { internalEntrySectionKey: "section-a" } : {}),
        kind: "set",
        order: 1,
        paper: set.paper,
        publicPath: setPath,
      },
      ...Arr.map(set.sections, (sectionKey, index) => ({
        ...base,
        ...keys,
        graph: graph(sectionKey),
        kind: "section",
        order: index + 1,
        ...(set.entry
          ? { visibility: "internal-entry" }
          : { publicPath: `${setPath}/${sectionKey}`, visibility: "visible" }),
        sectionKey,
      })),
    ],
    (row) => Schema.decodeUnknownSync(CatalogRowSchema)(row)
  );
}
