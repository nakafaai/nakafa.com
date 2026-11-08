import {
  Array as Arr,
  Match,
  Number as Num,
  Option,
  pipe,
  Schema,
  String as Str,
} from "effect";

/** The emoji a press on a message offers first, as WhatsApp's row does. */
export const QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

/** The categories of the chat's emoji, in the order the chooser shows them. */
export const EmojiCategory = Schema.Literals([
  "smileys",
  "people",
  "nature",
  "food",
  "activities",
  "travel",
  "objects",
  "symbols",
]);

/** The languages an emoji is named and found in. */
const EmojiLanguage = Schema.Literals(["id", "en", "de"]);

/**
 * One emoji as the chat ships it: the emoji, its category, and its name then its keywords, comma separated, in
 * Indonesian, English and German.
 */
export const EmojiEntry = Schema.Tuple([
  Schema.String,
  EmojiCategory,
  Schema.String,
  Schema.String,
  Schema.String,
]);

/** One emoji as the chooser shows and finds it: its name in the reader's language and every word it is found by. */
export const Emoji = Schema.Struct({
  category: EmojiCategory,
  emoji: Schema.String,
  name: Schema.String,
  words: Schema.Array(Schema.String),
});

/** What separates the words of an emoji's phrases. */
const PHRASE_BREAK = /[\s,]+/u;

/** What separates the words of a search. */
const QUERY_BREAK = /\s+/u;

/** The accents a search ignores. */
const ACCENTS = /\p{Diacritic}/gu;

/** One section of the chooser: the emoji of a category, or a search's matches, under its label. */
export const EmojiSection = Schema.Struct({
  emojis: Schema.Array(Emoji),
  key: Schema.String,
  label: Schema.String,
});

/** A text as a search compares it: lower case, without accents, so `senyum` and `Lächeln` match as typed. */
const fold = (text: string) =>
  pipe(text, Str.normalize("NFD"), Str.replace(ACCENTS, ""), Str.toLowerCase);

/** The words of some comma-separated phrases, each folded, with the parts of a hyphened word such as `kura-kura`. */
const wordsOf = (phrases: string) =>
  pipe(
    Str.split(fold(phrases), PHRASE_BREAK),
    Arr.filter(Str.isNonEmpty),
    Arr.flatMap((word) => Arr.dedupe([word, ...Str.split(word, "-")]))
  );

/**
 * An emoji for a reader of `language`: named in that language, and found by its words in that language and in
 * English, which many learners search in too.
 */
export const emojiOf = (
  [emoji, category, id, en, de]: typeof EmojiEntry.Type,
  language: string
): typeof Emoji.Type => {
  const own = Option.match(
    Schema.decodeUnknownOption(EmojiLanguage)(language),
    {
      onNone: () => en,
      onSome: (known) => ({ de, en, id })[known],
    }
  );
  return {
    category,
    emoji,
    name: Str.trim(Arr.headNonEmpty(Str.split(own, ","))),
    words: Arr.dedupe(Arr.appendAll(wordsOf(own), wordsOf(en))),
  };
};

/** The emoji whose words start with every word of `query`, in their order; an empty query keeps them all. */
export const matchEmoji = (
  emojis: readonly (typeof Emoji.Type)[],
  query: string
) => {
  const terms = pipe(
    Str.split(fold(query), QUERY_BREAK),
    Arr.filter(Str.isNonEmpty)
  );
  return Arr.filter(emojis, (emoji) =>
    Arr.every(terms, (term) =>
      Arr.some(emoji.words, (word) => Str.startsWith(term)(word))
    )
  );
};

/** The emoji of each category that holds any, in the chooser's order of categories. */
export const emojiSections = (emojis: readonly (typeof Emoji.Type)[]) =>
  Arr.filter(
    Arr.map(EmojiCategory.literals, (category) => ({
      category,
      emojis: Arr.filter(emojis, (emoji) => emoji.category === category),
    })),
    (section) => Arr.isReadonlyArrayNonEmpty(section.emojis)
  );

/** The first place of each section, in the order of every emoji shown, from how many emoji each section holds. */
export const sectionStarts = (sizes: readonly number[]) =>
  Arr.map(sizes, (_, section) =>
    Arr.reduce(Arr.take(sizes, section), 0, (sum, held) => sum + held)
  );

/**
 * The rows the chooser draws: each section starts a row of its own and fills rows of `columns`, so a row holds the
 * places, in the order of every emoji shown, that stand side by side on screen. A section holds one emoji at least.
 */
export const gridRows = (sizes: readonly number[], columns: number) =>
  Arr.flatMap(Arr.zip(sectionStarts(sizes), sizes), ([first, size]) =>
    Arr.chunksOf(
      Arr.makeBy(size, (offset) => first + offset),
      columns
    )
  );

/**
 * Where a key moves the active emoji, as a grid does: the arrows move one place, a row up or down keeps the column
 * or takes the row's last place, and Home and End go to the first and the last. A key that moves nothing answers
 * none, so the field keeps it.
 */
export const stepEmoji = (
  rows: readonly (readonly number[])[],
  active: number,
  key: string
) => {
  const places = Arr.flatMap(rows, (held, row) =>
    Arr.map(held, (index, column) => ({ column, index, row }))
  );
  return Option.flatMap(
    Arr.findFirst(places, (place) => place.index === active),
    ({ column, row }) => {
      /** The place in the row `offset` rows away, at the column or the row's last place. */
      const across = (offset: number) =>
        Option.match(Arr.get(rows, row + offset), {
          onNone: () => active,
          onSome: (held) =>
            Arr.getUnsafe(held, Num.min(column, held.length - 1)),
        });
      return pipe(
        Match.value(key),
        Match.when("ArrowDown", () => across(1)),
        Match.when("ArrowLeft", () => Num.max(active - 1, 0)),
        Match.when("ArrowRight", () => Num.min(active + 1, places.length - 1)),
        Match.when("ArrowUp", () => across(-1)),
        Match.when("End", () => places.length - 1),
        Match.when("Home", () => 0),
        Match.option
      );
    }
  );
};
