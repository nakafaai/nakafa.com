import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import {
  choiceAnswers,
  choiceLimit,
  encodeAnswers,
  encodeKey,
  matchAnswers,
  NEW_QUESTION_POINTS,
  numericAnswers,
  QuestionTemplate,
  shortAnswers,
  tableAnswers,
  textLabel,
} from "@repo/backend/confect/exams/question";
import {
  placeSeeded,
  type SeededExam,
} from "@repo/backend/confect/exams/seed/place";
import { paragraphsDocument } from "@repo/backend/confect/exams/seed/prompt";
import { Array as Arr, Effect, Schema } from "effect";

/** One seeded question: its prompt, its template, its interactions with every part written, and its key. */
const TemplateQuestion = Schema.Struct({
  answers: Schema.NonEmptyArray(InteractionSchema),
  key: Schema.NonEmptyArray(InteractionKeySchema),
  paragraphs: Schema.NonEmptyArray(Schema.String),
  template: QuestionTemplate,
});
type TemplateQuestion = typeof TemplateQuestion.Type;

/** A complex multiple choice of four numbers, whose student checks both even ones, the first and the third. */
const choices = (): TemplateQuestion => {
  const [choice] = choiceAnswers(
    Arr.map(["2", "3", "4", "5"] as const, (text) => textLabel(text))
  );
  return {
    answers: [{ ...choice, maxChoices: choiceLimit("choices", 4) }],
    key: [
      {
        correct: ["option-1", "option-3"],
        interaction: "choice",
        kind: "choice",
      },
    ],
    paragraphs: ["Pilih semua bilangan genap."],
    template: "choices",
  };
};

/** A true or false question whose statement is true. */
const trueFalse = (): TemplateQuestion => ({
  answers: choiceAnswers([textLabel("Benar"), textLabel("Salah")]),
  key: [{ correct: ["option-1"], interaction: "choice", kind: "choice" }],
  paragraphs: ["Air mendidih pada 100 derajat Celsius."],
  template: "truefalse",
});

/** A cause and effect question whose statement and reason are both true and related, the first relation. */
const cause = (): TemplateQuestion => ({
  answers: choiceAnswers([
    textLabel("Pernyataan dan alasan benar serta berhubungan"),
    textLabel("Pernyataan dan alasan benar tetapi tidak berhubungan"),
    textLabel("Pernyataan benar dan alasan salah"),
    textLabel("Pernyataan salah dan alasan benar"),
    textLabel("Pernyataan dan alasan salah"),
  ]),
  key: [{ correct: ["option-1"], interaction: "choice", kind: "choice" }],
  paragraphs: [
    "Logam memuai saat dipanaskan SEBAB partikelnya bergerak lebih cepat.",
  ],
  template: "cause",
});

/** A short answer whose accepted answer is Jakarta, read without case or extra spaces. */
const short = (): TemplateQuestion => ({
  answers: shortAnswers(),
  key: [
    {
      accepted: {
        acceptedAnswers: ["Jakarta"],
        collapseWhitespace: true,
        ignoreCase: true,
        kind: "text",
      },
      interaction: "entry",
      kind: "textEntry",
    },
  ],
  paragraphs: ["Apa ibu kota Indonesia?"],
  template: "short",
});

/** A numeric answer of three quarters, which takes the fraction as well as the decimal, within a hundredth. */
const numeric = (): TemplateQuestion => {
  const [number] = numericAnswers();
  return {
    answers: [{ ...number, acceptsFractions: true }],
    key: [
      {
        interaction: "number",
        kind: "numericEntry",
        tolerance: { kind: "absolute", value: "0.01" },
        value: "0.75",
      },
    ],
    paragraphs: ["Tulis tiga perempat sebagai bilangan."],
    template: "numeric",
  };
};

/** A matching of three countries and their capitals, each country paired with one capital. */
const match = (): TemplateQuestion => {
  const [pairs] = matchAnswers();
  return {
    answers: [
      {
        ...pairs,
        sources: [
          { id: "source-1", label: textLabel("Indonesia"), maxMatches: 1 },
          { id: "source-2", label: textLabel("Jepang"), maxMatches: 1 },
          { id: "source-3", label: textLabel("Jerman"), maxMatches: 1 },
        ],
        targets: [
          { id: "target-1", label: textLabel("Berlin"), maxMatches: 1 },
          { id: "target-2", label: textLabel("Jakarta"), maxMatches: 1 },
          { id: "target-3", label: textLabel("Tokyo"), maxMatches: 1 },
        ],
      },
    ],
    key: [
      {
        interaction: "match",
        kind: "match",
        pairs: [
          { source: "source-1", target: "target-2" },
          { source: "source-2", target: "target-3" },
          { source: "source-3", target: "target-1" },
        ],
      },
    ],
    paragraphs: ["Jodohkan negara dengan ibu kotanya."],
    template: "match",
  };
};

/** A true or false table of three statements, the second of them false. */
const table = (): TemplateQuestion => {
  const [sheet] = tableAnswers(["Benar", "Salah"]);
  return {
    answers: [
      {
        ...sheet,
        statements: [
          {
            id: "statement-1",
            label: textLabel("Air mendidih pada 100 derajat Celsius."),
          },
          {
            id: "statement-2",
            label: textLabel("Matahari mengelilingi Bumi."),
          },
          { id: "statement-3", label: textLabel("Es lebih ringan dari air.") },
        ],
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
    paragraphs: ["Tentukan benar atau salah setiap pernyataan."],
    template: "table",
  };
};

/**
 * Places one question of every template but the single choice and the essay after `after`, in the order
 * the editor's type menu lists them: a complex multiple choice, true or false, cause and effect, a short
 * answer, a numeric answer, a matching, and a true or false table. Each has every part written and a key that fits it, so the
 * exam schedules, and a browser test sits and scores every template. It returns the last question's ID.
 */
export const seedTemplates = Effect.fn("exams.seed.templates")(function* (
  exam: SeededExam,
  after: ExamQuestionsDoc["_id"]
) {
  const placed = yield* Effect.reduce(
    [choices(), trueFalse(), cause(), short(), numeric(), match(), table()],
    () => ({ last: after, questions: exam.questions }),
    (state, question) =>
      Effect.gen(function* () {
        const last = yield* placeSeeded(
          { ...exam, questions: state.questions },
          state.last,
          paragraphsDocument(question.paragraphs),
          {
            answers: yield* encodeAnswers(question.answers),
            key: yield* encodeKey(question.key),
            points: NEW_QUESTION_POINTS,
            template: question.template,
          }
        );
        return { last, questions: Arr.append(state.questions, last) };
      })
  );
  return placed.last;
});
