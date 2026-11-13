import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  type InteractionKey,
  InteractionKeySchema,
} from "@nakafa/aksara-contracts/assessment/key";
import {
  choiceAnswers,
  essayAnswers,
  matchAnswers,
  numericAnswers,
  shortAnswers,
  tableAnswers,
} from "@repo/backend/confect/exams/blank";
import { ExamView } from "@repo/backend/confect/exams/exam";
import {
  choiceLimit,
  QuestionTemplate,
} from "@repo/backend/confect/exams/question";
import { reasonChoice } from "@repo/backend/confect/exams/reason";
import { ALL_OR_NOTHING } from "@repo/backend/confect/exams/scoring";
import { Array as Arr, Record as Rec, Schema } from "effect";
import {
  DEMO_EXAM_ID,
  DEMO_SLUG,
  formulaLabel,
  latexLabel,
  sentenceLabel,
  sentenceText,
} from "@/components/marketing/school/demo/seed";

/** The options of the single choice, each a momentum, the third one right. */
const MOMENTA = [
  "1.5\\ \\text{kg}\\cdot\\text{m/s}",
  "5\\ \\text{kg}\\cdot\\text{m/s}",
  "6\\ \\text{kg}\\cdot\\text{m/s}",
  "9\\ \\text{kg}\\cdot\\text{m/s}",
] as const;

/** One question of the paper: its prompt, its interactions, and the key that scores them. */
const PaperQuestion = Schema.Struct({
  answers: Schema.Array(InteractionSchema),
  key: Schema.NullOr(Schema.Array(InteractionKeySchema)),
  prompt: Schema.String,
});

/** A key that marks `correct` among the options of the choice `interaction`. */
const chosen = (
  correct: readonly string[],
  interaction = "choice"
): InteractionKey => ({ correct, interaction, kind: "choice" });

/**
 * The paper of the School landing's player, in the reader's language: one question of every type a teacher writes in
 * the School, in the order the editor's type menu lists them, all on momentum. Each sentence comes from the
 * dictionary with its formulas as tags, and the fixed words of a type (true and false, the five relations of cause
 * and effect) are the School's own. The exam's own schema decodes it, so the paper holds nothing the server would
 * refuse.
 */
export function paperExam(texts: {
  readonly answer: string;
  /** The five relations of a cause and effect question, in the order the School writes them. */
  readonly causes: Arr.NonEmptyReadonlyArray<string>;
  readonly cause: string;
  readonly choice: string;
  readonly choices: string;
  readonly essay: string;
  readonly mass: string;
  readonly match: string;
  readonly momentum: string;
  readonly numeric: string;
  readonly reason: string;
  /** The answers of the two-tier question, then its reasons. */
  readonly reasons: {
    readonly answers: Arr.NonEmptyReadonlyArray<string>;
    readonly why: Arr.NonEmptyReadonlyArray<string>;
  };
  readonly short: string;
  readonly table: string;
  /** The statements of the true or false table. */
  readonly statements: Arr.NonEmptyReadonlyArray<string>;
  readonly time: string;
  readonly title: string;
  readonly truefalse: string;
  /** True, then false, in the School's words. */
  readonly truth: readonly [string, string];
  readonly velocity: string;
}) {
  const [truth, falsehood] = texts.truth;
  const [match] = matchAnswers();
  const [table] = tableAnswers(texts.truth);
  const [choices] = choiceAnswers(
    Arr.map([texts.velocity, texts.mass, texts.momentum, texts.time], (word) =>
      sentenceLabel(word)
    )
  );
  const [reason] = choiceAnswers(
    Arr.map(texts.reasons.answers, (word) => sentenceLabel(word))
  );
  const why = reasonChoice();
  const [number] = numericAnswers();
  const paper: Record<QuestionTemplate, typeof PaperQuestion.Type> = {
    cause: {
      answers: choiceAnswers(
        Arr.map(texts.causes, (relation) => sentenceLabel(relation))
      ),
      key: [chosen(["option-1"])],
      prompt: texts.cause,
    },
    choice: {
      answers: [
        {
          ...choiceAnswers(Arr.map(MOMENTA, (latex) => latexLabel(latex)))[0],
          label: texts.answer,
        },
      ],
      key: [chosen(["option-3"])],
      prompt: texts.choice,
    },
    choices: {
      answers: [{ ...choices, maxChoices: choiceLimit("choices", 4) }],
      key: [chosen(["option-1", "option-3"])],
      prompt: texts.choices,
    },
    essay: { answers: essayAnswers(), key: null, prompt: texts.essay },
    match: {
      answers: [
        {
          ...match,
          sources: Arr.zipWith(
            match.sources,
            [texts.mass, texts.velocity, texts.momentum],
            (source, word) => ({ ...source, label: sentenceLabel(word) })
          ),
          targets: Arr.zipWith(
            match.targets,
            ["rate", "unit", "kilogram"],
            (target, name) => ({ ...target, label: formulaLabel(name) })
          ),
        },
      ],
      key: [
        {
          interaction: "match",
          kind: "match",
          pairs: [
            { source: "source-1", target: "target-3" },
            { source: "source-2", target: "target-1" },
            { source: "source-3", target: "target-2" },
          ],
        },
      ],
      prompt: texts.match,
    },
    numeric: {
      answers: [number],
      key: [{ interaction: "number", kind: "numericEntry", value: "10" }],
      prompt: texts.numeric,
    },
    reason: {
      answers: [
        reason,
        {
          ...why,
          options: Arr.map(texts.reasons.why, (word, index) => ({
            id: `${why.id}-${index + 1}`,
            label: sentenceLabel(word),
          })),
        },
      ],
      key: [chosen(["option-1"]), chosen(["reason-1"], why.id)],
      prompt: texts.reason,
    },
    short: {
      answers: shortAnswers(),
      key: [
        {
          accepted: {
            acceptedAnswers: ["kg m/s", "kg·m/s", "kgm/s"],
            collapseWhitespace: true,
            ignoreCase: true,
            kind: "text",
          },
          interaction: "entry",
          kind: "textEntry",
        },
      ],
      prompt: texts.short,
    },
    table: {
      answers: [
        {
          ...table,
          statements: Arr.zipWith(
            table.statements,
            texts.statements,
            (statement, words) => ({
              ...statement,
              label: sentenceLabel(words),
            })
          ),
        },
      ],
      key: [
        {
          answers: [
            { column: "column-1", statement: "statement-1" },
            { column: "column-2", statement: "statement-2" },
            { column: "column-1", statement: "statement-3" },
          ],
          interaction: "matrix",
          kind: "matrix",
        },
      ],
      prompt: texts.table,
    },
    truefalse: {
      answers: choiceAnswers([sentenceLabel(truth), sentenceLabel(falsehood)]),
      key: [chosen(["option-1"])],
      prompt: texts.truefalse,
    },
  };
  const templates = QuestionTemplate.literals;
  const exam = Schema.encodeSync(ExamView)(
    Schema.decodeUnknownSync(ExamView)({
      archived: false,
      id: DEMO_EXAM_ID,
      questions: Arr.map(templates, (template) => ({
        answers: paper[template].answers,
        explanation: `${template}explanation`,
        id: template,
        key: paper[template].key,
        media: [],
        points: 1,
        prompt: `${template}prompt`,
        reading: null,
        revision: 0,
        rubric: `${template}rubric`,
        scoring: ALL_OR_NOTHING,
        template,
      })),
      title: texts.title,
    })
  );

  return {
    documents: Rec.fromEntries(
      Arr.flatMap(templates, (template) => [
        [`${template}prompt`, sentenceText(paper[template].prompt)],
        [`${template}explanation`, sentenceText("")],
        [`${template}rubric`, sentenceText("")],
      ])
    ),
    exam,
    slug: DEMO_SLUG,
  };
}
