import {
  TryoutSectionSchema,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import { Schema } from "effect";

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

/** Builds one signed set contract for runtime tests. */
export function makeTryoutSet(options: TryoutSetFixtureOptions = {}) {
  const setKey = options.setKey ?? "set-1";

  return Schema.decodeUnknownSync(TryoutSetSchema)({
    countryKey: "indonesia",
    examKey: options.examKey ?? "snbt",
    graph: makeTryoutGraph("set", setKey),
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
    trackKey: options.trackKey ?? "2027",
    visibleSectionCount: options.visibleSectionCount ?? 1,
  });
}

/** Builds one signed section contract for runtime tests. */
export function makeTryoutSection(options: TryoutSectionFixtureOptions = {}) {
  const sectionKey = options.sectionKey ?? TRYOUT_SECTION_KEY;
  const setKey = options.setKey ?? "set-1";
  const sourcePath = `question-bank/tryout/indonesia/snbt/${sectionKey}/${setKey}`;

  return Schema.decodeUnknownSync(TryoutSectionSchema)({
    countryKey: "indonesia",
    examKey: options.examKey ?? "snbt",
    graph: makeTryoutGraph("section", sectionKey),
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
    trackKey: options.trackKey ?? "2027",
    visibility: options.visibility ?? "visible",
  });
}

/** Builds a stable graph identity for one signed fixture row. */
function makeTryoutGraph(kind: "section" | "set", key: string) {
  return {
    alignmentId: `alignment:tryout:runtime:${kind}:${key}`,
    assetId: `asset:id:tryout:runtime:${kind}:${key}`,
    conceptId: `concept:tryout:runtime:${kind}:${key}`,
    learningObjectId: `lo:tryout-runtime-${kind}-${key}`,
    lensId: "lens:tryout:runtime",
  };
}
