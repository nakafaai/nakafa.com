import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeQuestionProjection,
  HistoricalQuestionBodyProjectionSchema,
  QuestionPromptProjectionSchema,
} from "@nakafa/aksara-contracts/projection/question";
import { Schema } from "effect";

export const TEST_QUESTION_SET_KEY =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1";
export const TEST_QUESTION_KEY = `${TEST_QUESTION_SET_KEY}/question-1`;
export const TEST_QUESTION_CONTENT_KEY = `${TEST_QUESTION_KEY}/question`;
export const TEST_QUESTION_SOURCE = CorpusSourcePathSchema.make(
  `packages/corpus/${TEST_QUESTION_KEY}/question.en.mdx`
);

const identity = {
  artifactLocale: "en",
  bodyKind: "question",
  contentKey: TEST_QUESTION_CONTENT_KEY,
  kind: "question-body",
  peerContentKey: `${TEST_QUESTION_KEY}/answer`,
  questionKey: TEST_QUESTION_KEY,
  questionNumber: 1,
  setKey: TEST_QUESTION_SET_KEY,
} as const;

/** Current Question projection accepted for newly staged releases. */
export const TEST_QUESTION_PROJECTION = Schema.decodeSync(
  QuestionPromptProjectionSchema
)({
  ...identity,
  metadata: {
    authors: [{ name: "Nakafa" }],
    datePublished: "2026-07-24",
    title: "Technical question",
  },
  response: {
    kind: "single-choice",
    options: [
      {
        isCorrect: true,
        label: "Correct",
        optionKey: "option-1",
        order: 1,
      },
      {
        isCorrect: false,
        label: "Incorrect",
        optionKey: "option-2",
        order: 2,
      },
    ],
  },
});
export const TEST_QUESTION_PROJECTION_JSON = canonicalizeQuestionProjection(
  TEST_QUESTION_PROJECTION
);

/** Prior Question projection admitted only by authenticated recovery staging. */
export const TEST_HISTORICAL_QUESTION_PROJECTION = Schema.decodeSync(
  HistoricalQuestionBodyProjectionSchema
)({
  ...identity,
  choices: [
    { label: "Correct", value: true },
    { label: "Incorrect", value: false },
  ],
  metadata: {
    authors: [{ name: "Nakafa" }],
    date: "2026-07-24",
    title: "Technical question",
  },
});
export const TEST_HISTORICAL_QUESTION_PROJECTION_JSON =
  canonicalizeQuestionProjection(TEST_HISTORICAL_QUESTION_PROJECTION);
