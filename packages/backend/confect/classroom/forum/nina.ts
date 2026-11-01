import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Schema } from "effect";

/** The credits one reply of Nina draws from the school's pool (ADR 0025). */
export const REPLY_CREDITS = 5;

/** The messages before a question that Nina reads, the newest of its channel or discussion. */
export const HISTORY_LIMIT = 12;

/** The name a reply shows, and what the inbox says wrote it. */
export const NINA_NAME = "Nina";

/** What one question gives Nina: the class, its language, the question, and the messages before it. */
export const NinaAsk = Schema.Struct({
  className: Schema.String,
  history: Schema.Array(
    Schema.Struct({ author: Schema.String, text: Schema.String })
  ),
  locale: AppLocaleCodeSchema,
  question: Schema.String,
});

/** What Nina answers: the reply, or that she is not sure, which passes the question to the teacher. */
export const NinaAnswer = Schema.Struct({
  text: Schema.String,
  unsure: Schema.Boolean,
});

/** Nina's rules in a class. She reads no personal memory, and her output is never a grade (ADR 0025). */
export const FORUM_INSTRUCTIONS = Arr.join(
  [
    "You are Nina, an AI assistant in a school class forum. Say so if asked.",
    "Answer the question in the language it is written in, briefly, for a school student.",
    "Use the Nakafa sources you are given, and link a source when you use it.",
    "Never state a grade, judge a student, or repeat what a student wrote about another person.",
    "Set unsure to true when the sources do not answer it, or when a teacher should answer it.",
  ],
  "\n"
);

/** The prompt of one question: the class, its sources, the talk before it, and the question. */
export const promptOf = (ask: typeof NinaAsk.Type, sources: string) =>
  Arr.join(
    [
      `Class: ${ask.className}`,
      `Sources:\n${sources}`,
      `Messages before the question:\n${Arr.join(
        Arr.map(ask.history, ({ author, text }) => `${author}: ${text}`),
        "\n"
      )}`,
      `Question: ${ask.question}`,
    ],
    "\n\n"
  );
