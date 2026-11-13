import {
  essayAnswers,
  numericAnswers,
} from "@repo/backend/confect/exams/blank";
import { ExamView } from "@repo/backend/confect/exams/exam";
import { ALL_OR_NOTHING } from "@repo/backend/confect/exams/scoring";
import { Array as Arr, Schema } from "effect";
import {
  DEMO_EXAM_ID,
  DEMO_SLUG,
  formulaText,
  latexLabel,
  sentenceText,
} from "@/components/marketing/school/demo/seed";

/** The options of the first question, each a momentum, the third one right. */
const MOMENTA = [
  "1.5\\ \\text{kg}\\cdot\\text{m/s}",
  "5\\ \\text{kg}\\cdot\\text{m/s}",
  "6\\ \\text{kg}\\cdot\\text{m/s}",
  "9\\ \\text{kg}\\cdot\\text{m/s}",
] as const;

/**
 * The exam of the School landing's editor, in the reader's language, as the server answers it: a choice question on
 * momentum with formulas in its prompt, its options and its explanation, a numeric question whose key is a decimal,
 * and an essay that a rubric scores. Each sentence comes from the dictionary with its formulas as tags, so every
 * language draws the same formulas as math. The exam's own schema decodes it, so the demo holds nothing the server
 * would refuse.
 */
export function demoExam(texts: {
  readonly answer: string;
  readonly essay: string;
  readonly explanation: string;
  readonly numeric: string;
  readonly question: string;
  readonly rubric: string;
  readonly title: string;
}) {
  const exam = Schema.encodeSync(ExamView)(
    Schema.decodeUnknownSync(ExamView)({
      archived: false,
      id: DEMO_EXAM_ID,
      questions: [
        {
          answers: [
            {
              id: "choice",
              kind: "choice",
              label: texts.answer,
              maxChoices: 1,
              minChoices: 1,
              options: Arr.map(MOMENTA, (latex, index) => ({
                id: `option-${index + 1}`,
                label: latexLabel(latex),
              })),
              shuffle: false,
            },
          ],
          explanation: "seedexplanation1",
          id: "seedquestion1",
          key: [
            { correct: ["option-3"], interaction: "choice", kind: "choice" },
          ],
          media: [],
          points: 4,
          prompt: "seedprompt1",
          reading: null,
          revision: 0,
          rubric: "seedrubric1",
          scoring: ALL_OR_NOTHING,
          template: "choice",
        },
        {
          answers: numericAnswers(),
          explanation: "seedexplanation2",
          id: "seedquestion2",
          key: [{ interaction: "number", kind: "numericEntry", value: "10" }],
          media: [],
          points: 3,
          prompt: "seedprompt2",
          reading: null,
          revision: 0,
          rubric: "seedrubric2",
          scoring: ALL_OR_NOTHING,
          template: "numeric",
        },
        {
          answers: essayAnswers(),
          explanation: "seedexplanation3",
          id: "seedquestion3",
          key: null,
          media: [],
          points: 6,
          prompt: "seedprompt3",
          reading: null,
          revision: 0,
          rubric: "seedrubric3",
          scoring: ALL_OR_NOTHING,
          template: "essay",
        },
      ],
      title: texts.title,
    })
  );

  return {
    documents: {
      seedexplanation1: sentenceText(texts.explanation),
      seedexplanation2: formulaText("total"),
      seedexplanation3: sentenceText(""),
      seedprompt1: sentenceText(texts.question),
      seedprompt2: sentenceText(texts.numeric),
      seedprompt3: sentenceText(texts.essay),
      seedrubric1: sentenceText(""),
      seedrubric2: sentenceText(""),
      seedrubric3: sentenceText(texts.rubric),
    },
    exam,
    slug: DEMO_SLUG,
  };
}
