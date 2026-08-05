import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import {
  type LearningGraphSegments,
  makeLearningGraphIdentity,
} from "@nakafa/aksara-contracts/graph/identity";
import {
  TryoutSectionSchema,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import { Effect, Schema } from "effect";

export const TRYOUT_TEST_NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
export const TRYOUT_COUNTRY_PATH = "try-out/indonesia";
export const TRYOUT_EXAM_PATH = `${TRYOUT_COUNTRY_PATH}/snbt`;
export const TRYOUT_TRACK_PATH = `${TRYOUT_EXAM_PATH}/2027`;
export const TRYOUT_SET_PATH = `${TRYOUT_TRACK_PATH}/set-1`;
export const TRYOUT_SECTION_KEY = "penalaran-matematika";
export const TRYOUT_SECTION_PATH = `${TRYOUT_SET_PATH}/${TRYOUT_SECTION_KEY}`;

type TryoutSetFixtureOptions = Partial<
  Pick<
    Schema.Schema.Encoded<typeof TryoutSetSchema>,
    | "examKey"
    | "internalEntrySectionKey"
    | "order"
    | "publicPath"
    | "questionCount"
    | "sectionCount"
    | "setKey"
    | "title"
    | "trackKey"
    | "visibleSectionCount"
  >
>;

type TryoutSectionFixtureOptions = Partial<
  Pick<
    Schema.Schema.Encoded<typeof TryoutSectionSchema>,
    | "examKey"
    | "order"
    | "publicPath"
    | "questionCount"
    | "questionSourcePath"
    | "sectionKey"
    | "setKey"
    | "sourceRevision"
    | "title"
    | "trackKey"
    | "visibility"
  >
>;

interface TryoutExamGraphInput {
  readonly countryKey: string;
  readonly examKey: string;
  readonly kind: "exam";
  readonly locale?: ContentLocale;
}

interface TryoutSetGraphInput {
  readonly countryKey: string;
  readonly examKey: string;
  readonly kind: "set";
  readonly locale?: ContentLocale;
  readonly setKey: string;
  readonly trackKey: string;
}

interface TryoutSectionGraphInput {
  readonly countryKey: string;
  readonly examKey: string;
  readonly kind: "section";
  readonly locale?: ContentLocale;
  readonly sectionKey: string;
  readonly setKey: string;
  readonly trackKey: string;
}

type TryoutGraphInput =
  | TryoutExamGraphInput
  | TryoutSetGraphInput
  | TryoutSectionGraphInput;

/** Derives the exact graph identity owned by one signed try-out row. */
export function testTryoutGraph(input: TryoutGraphInput) {
  const locale = input.locale ?? "id";
  const examLens: LearningGraphSegments["lens"] = [
    "tryout",
    input.countryKey,
    input.examKey,
  ];
  if (input.kind === "exam") {
    return Effect.runSync(
      makeLearningGraphIdentity({
        concept: examLens,
        learningObject: ["tryout-exam", input.countryKey, input.examKey],
        lens: examLens,
        locale,
      })
    );
  }

  if (input.kind === "set") {
    return Effect.runSync(
      makeLearningGraphIdentity({
        concept: [...examLens, input.trackKey, input.setKey],
        learningObject: [
          "tryout-set",
          input.countryKey,
          input.examKey,
          input.trackKey,
          input.setKey,
        ],
        lens: examLens,
        locale,
      })
    );
  }

  return Effect.runSync(
    makeLearningGraphIdentity({
      concept: [...examLens, input.trackKey, input.sectionKey],
      learningObject: [
        "tryout-section",
        input.countryKey,
        input.examKey,
        input.trackKey,
        input.setKey,
        input.sectionKey,
      ],
      lens: examLens,
      locale,
    })
  );
}

/** Builds one signed set contract for runtime tests. */
export function makeTryoutSet(options: TryoutSetFixtureOptions = {}) {
  const examKey = options.examKey ?? "snbt";
  const setKey = options.setKey ?? "set-1";
  const trackKey = options.trackKey ?? "2027";

  return Schema.decodeUnknownSync(TryoutSetSchema)({
    countryKey: "indonesia",
    examKey,
    graph: testTryoutGraph({
      countryKey: "indonesia",
      examKey,
      kind: "set",
      setKey,
      trackKey,
    }),
    internalEntrySectionKey: options.internalEntrySectionKey,
    kind: "set",
    locale: "id",
    order: options.order ?? (setKey === "set-1" ? 1 : 2),
    publicPath: options.publicPath ?? `${TRYOUT_TRACK_PATH}/${setKey}`,
    questionCount: options.questionCount ?? 1,
    scoringStrategy: "irt",
    sectionCount: options.sectionCount ?? 1,
    setKey,
    sourceRevision: "2026",
    title: options.title ?? (setKey === "set-1" ? "Set 1" : "Set 2"),
    trackKey,
    visibleSectionCount: options.visibleSectionCount ?? 1,
  });
}

/** Builds one signed section contract for runtime tests. */
export function makeTryoutSection(options: TryoutSectionFixtureOptions = {}) {
  const examKey = options.examKey ?? "snbt";
  const sectionKey = options.sectionKey ?? TRYOUT_SECTION_KEY;
  const setKey = options.setKey ?? "set-1";
  const trackKey = options.trackKey ?? "2027";
  const sourcePath = `question-bank/tryout/indonesia/snbt/${sectionKey}/${setKey}`;

  return Schema.decodeUnknownSync(TryoutSectionSchema)({
    countryKey: "indonesia",
    examKey,
    graph: testTryoutGraph({
      countryKey: "indonesia",
      examKey,
      kind: "section",
      sectionKey,
      setKey,
      trackKey,
    }),
    kind: "section",
    locale: "id",
    order: options.order ?? 1,
    publicPath: options.publicPath ?? `${TRYOUT_SET_PATH}/${sectionKey}`,
    questionCount: options.questionCount ?? 1,
    questionSourcePath:
      options.questionSourcePath ?? `packages/corpus/${sourcePath}`,
    sectionKey,
    setKey,
    sourceRevision: options.sourceRevision ?? "2026",
    timeLimitSeconds: 1800,
    title: options.title ?? "Penalaran Matematika",
    trackKey,
    visibility: options.visibility ?? "visible",
  });
}
