import { Schema } from "effect";

/**
 * One note the capture model could propose, with the answer each of its
 * judgments should give (`judgment/catalog`): `ownNote`, whether the sentence
 * reads as the learner's own note, in the language of the quote and not
 * describing the learner from the outside, and `private`, whether the sentence
 * with its quote holds something private. `text` is the sentence and `quote`
 * the learner's words it rests on, which the decision model reads as they are
 * (`noteText` of `judgment/note`). `languages` holds the ISO 639 code of the
 * language of the quote, or two codes joined by `+` when the note mixes two.
 * `script` is the ISO 15924 code of its script. `form` describes a note that is
 * private or not the learner's own, without quoting it: the kind of private
 * data it holds, or the fault of the sentence.
 *
 * Every note is invented for this set. None holds a real person's data:
 * numbers, addresses and names are made up.
 */
const Note = Schema.Struct({
  form: Schema.optionalKey(Schema.NonEmptyString),
  languages: Schema.NonEmptyString,
  ownNote: Schema.Boolean,
  private: Schema.Boolean,
  quote: Schema.NonEmptyString,
  script: Schema.NonEmptyString,
  text: Schema.NonEmptyString,
});

/** One labelled note of the set. */
export type Row = typeof Note.Type;

/** A sentence in the learner's own voice and language, with nothing private. */
export function own(
  languages: string,
  script: string,
  text: string,
  quote: string
): Row {
  return { languages, ownNote: true, private: false, quote, script, text };
}

/** A sentence that describes the learner from the outside, or is not in the language of its quote, with nothing private. `form` names the fault. */
export function outside(
  languages: string,
  script: string,
  form: string,
  text: string,
  quote: string
): Row {
  return {
    form,
    languages,
    ownNote: false,
    private: false,
    quote,
    script,
    text,
  };
}

/** A sentence in the learner's own voice that holds private data of one form. */
export function secret(
  languages: string,
  script: string,
  form: string,
  text: string,
  quote: string
): Row {
  return { form, languages, ownNote: true, private: true, quote, script, text };
}

/** A sentence that describes the learner from the outside and holds private data of one form. */
export function exposed(
  languages: string,
  script: string,
  form: string,
  text: string,
  quote: string
): Row {
  return {
    form,
    languages,
    ownNote: false,
    private: true,
    quote,
    script,
    text,
  };
}
