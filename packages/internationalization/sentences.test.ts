import { describe, expect, it } from "@effect/vitest";
import { SentenceKeySchema } from "@repo/internationalization/sentences";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import {
  Array as Arr,
  Option,
  pipe,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";

/** The locales that have a dictionary, so each one's covered messages can be checked. */
const Locales = Schema.Literals(["de", "en", "id"]);

/** The messages of one locale: each namespace holds its messages by key. */
type Messages = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** A sentence ends with a period, a question mark or an exclamation mark, optionally followed by a closing quote. */
const SENTENCE_END = /[.?!]["'”’»]?$/u;

/** A second sentence starts where a period, question mark or exclamation mark is followed by a space and a capital letter. */
const SENTENCE_START = /[.?!] \p{Lu}/u;

/** An ICU argument such as `{address}`, including one level of nested arguments such as plural forms. */
const ICU_ARGUMENT = /\{(?:[^{}]|\{[^{}]*\})*\}/gu;

/** Math between two dollar signs. */
const MATH = /\$[^$]*\$/gu;

/**
 * Whether a message is one sentence: it ends with a sentence end, and no second
 * sentence starts inside it. The inside of an ICU argument and of math does not count.
 */
function isOneSentence(text: string) {
  const prose = pipe(
    text,
    Str.replaceAll(ICU_ARGUMENT, ""),
    Str.replaceAll(MATH, "")
  );
  return SENTENCE_END.test(text) && !SENTENCE_START.test(prose);
}

/** Whether a dictionary value is a group of messages by key. */
const isGroup = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

/**
 * The text under a dotted key, such as `Memory.empty-description` or
 * `Ai.failures.unknown`, or none when the dictionary has no text there.
 */
function messageOf(messages: Messages, key: string) {
  return pipe(
    Str.split(key, "."),
    Arr.reduce(Option.some<unknown>(messages), (value, name) =>
      Option.flatMap(Option.filter(value, isGroup), (group) =>
        Rec.get(group, name)
      )
    ),
    Option.filter(Schema.is(Schema.String))
  );
}

describe("the one-sentence rule", () => {
  it.each(Locales.literals)(
    "finds every covered message in %s, so no listed key is missing from a dictionary",
    async (locale) => {
      const messages = await loadLocaleMessages(locale);
      const missing = Arr.filter(SentenceKeySchema.literals, (key) =>
        Option.isNone(messageOf(messages, key))
      );

      expect(missing).toEqual([]);
    }
  );

  it.each(Locales.literals)(
    "gives every covered message in %s one sentence that ends with a period, a question mark or an exclamation mark",
    async (locale) => {
      const messages = await loadLocaleMessages(locale);
      const notOneSentence = Arr.flatMap(SentenceKeySchema.literals, (key) =>
        Option.match(messageOf(messages, key), {
          onNone: () => [],
          onSome: (text) => (isOneSentence(text) ? [] : [{ key, text }]),
        })
      );

      expect(notOneSentence).toEqual([]);
    }
  );
});
