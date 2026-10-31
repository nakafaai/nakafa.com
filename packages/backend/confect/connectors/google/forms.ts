import { GoogleFailed } from "@repo/backend/confect/connectors/errors";
import { GOOGLE_DEADLINE } from "@repo/backend/confect/connectors/google/oauth";
import type { PlacedQuestion } from "@repo/backend/confect/exams/import";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/** The forms endpoint of Google Forms. */
const FORMS_ROOT = "https://forms.googleapis.com/v1/forms/";

/** How Google names a question that takes one of its options. */
const ONE_CHOICE = ["DROP_DOWN", "RADIO"];

/** One question of a form: its options, when it offers some, and its answer key, when it has one. */
const FormQuestion = Schema.Struct({
  choiceQuestion: Schema.optionalKey(
    Schema.Struct({
      options: Schema.Array(
        Schema.Struct({ value: Schema.optionalKey(Schema.String) })
      ),
      type: Schema.String,
    })
  ),
  grading: Schema.optionalKey(
    Schema.Struct({
      correctAnswers: Schema.optionalKey(
        Schema.Struct({
          answers: Schema.Array(Schema.Struct({ value: Schema.String })),
        })
      ),
    })
  ),
});

/** One item of a form, as `forms.get` answers it: a question has a `questionItem`, and a heading has none. */
const FormItem = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  questionItem: Schema.optionalKey(Schema.Struct({ question: FormQuestion })),
  title: Schema.optionalKey(Schema.String),
});

/** What `forms.get` answers for a form that has items. */
const FormAnswer = Schema.fromJsonString(
  Schema.Struct({ items: Schema.optionalKey(Schema.Array(FormItem)) })
);

/** One question of a form as an import places it: a choice takes its options and key, and any other shows as left out. */
const placedOf = (
  item: typeof FormItem.Type,
  question: typeof FormQuestion.Type,
  number: number
): typeof PlacedQuestion.Type => {
  const choice = Option.filter(
    Option.fromUndefinedOr(question.choiceQuestion),
    (found) => Arr.contains(ONE_CHOICE, found.type)
  );
  const options = Option.match(choice, {
    onNone: () => [],
    onSome: (found) =>
      Arr.getSomes(
        Arr.map(found.options, (option) =>
          Option.fromUndefinedOr(option.value)
        )
      ),
  });
  const key = Arr.head(question.grading?.correctAnswers?.answers ?? []);
  return {
    answer: Option.getOrNull(
      Option.flatMap(key, ({ value }) =>
        Arr.findFirstIndex(options, (option) => option === value)
      )
    ),
    explanation: "",
    figures: [],
    number,
    options,
    prompt: Arr.join(
      Arr.getSomes([
        Option.fromUndefinedOr(item.title),
        Option.fromUndefinedOr(item.description),
      ]),
      "\n"
    ),
  };
};

/** The questions of a form in order, numbered from one. A heading or a section is no question. */
export const placedQuestionsOf = (items: readonly (typeof FormItem.Type)[]) =>
  Arr.map(
    Arr.getSomes(
      Arr.map(items, (item) =>
        Option.map(
          Option.fromUndefinedOr(item.questionItem),
          ({ question }) => ({ item, question })
        )
      )
    ),
    ({ item, question }, index) => placedOf(item, question, index + 1)
  );

/**
 * Reads one form with the connection's access token. `drive.file` covers a form the user picked
 * with Nakafa, so a form that was not picked is refused (ADR 0015). Google refusing the token
 * fails as `revoked`, and any other answer as `refused`.
 */
export const readForm = (accessToken: string, formId: string) =>
  Effect.gen(function* () {
    const response = yield* (yield* HttpClient.HttpClient)
      .execute(
        HttpClientRequest.get(
          new URL(encodeURIComponent(formId), FORMS_ROOT)
        ).pipe(HttpClientRequest.bearerToken(accessToken))
      )
      .pipe(
        Effect.timeout(GOOGLE_DEADLINE),
        Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
      );
    if (response.status === 401) {
      return yield* new GoogleFailed({ reason: "revoked", status: 401 });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new GoogleFailed({
        reason: "refused",
        status: response.status,
      });
    }
    const form = yield* response.text.pipe(
      Effect.flatMap(Schema.decodeEffect(FormAnswer)),
      Effect.mapError(() => new GoogleFailed({ reason: "invalid" }))
    );
    return placedQuestionsOf(form.items ?? []);
  }).pipe(Effect.scoped);
