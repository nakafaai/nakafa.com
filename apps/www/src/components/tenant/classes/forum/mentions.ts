import type {
  MentionablePerson,
  MentionView,
} from "@repo/backend/confect/classroom/forum/mention";
import { MENTION_LIMIT } from "@repo/backend/confect/classroom/forum/mention";
import { Array as Arr, Option, Order, Schema, String as Str } from "effect";

/** One Person a writer may mention. */
type Person = typeof MentionablePerson.Type;

/** A space or a line break, after which `@` opens a mention. */
const SPACE = /\s/u;

/** What ends a mention being typed: a line break or a second `@`. */
const MENTION_END = /[\n@]/u;

/** The most Persons the mention list shows at once. */
const MENTION_OPTIONS = 8;

/**
 * The mention being typed before the caret: the `@` at the start of the text or
 * after a space or a line break, and the letters typed after it, up to the caret.
 * A line break or a second `@` ends it.
 */
export const mentionQuery = (text: string, caret: number) => {
  const before = Str.slice(0, caret)(text);
  const at = before.lastIndexOf("@");
  if (at < 0) {
    return Option.none();
  }
  const query = Str.slice(at + 1)(before);
  const opens = at === 0 || SPACE.test(before.charAt(at - 1));
  if (!opens || MENTION_END.test(query) || query.length > 40) {
    return Option.none();
  }
  return Option.some({ query, start: at });
};

/** The Persons whose name holds the typed letters, without regard to case, the ones it starts first. */
export const matchPeople = (people: readonly Person[], query: string) => {
  const wanted = Str.toLowerCase(Str.trim(query));
  const named = Arr.filter(people, (person) =>
    Str.toLowerCase(person.name).includes(wanted)
  );
  return Arr.take(
    Arr.appendAll(
      Arr.filter(named, (person) =>
        Str.toLowerCase(person.name).startsWith(wanted)
      ),
      Arr.filter(
        named,
        (person) => !Str.toLowerCase(person.name).startsWith(wanted)
      )
    ),
    MENTION_OPTIONS
  );
};

/**
 * The text with the mention being typed replaced by `@name` and a space, and the
 * caret after them.
 */
export const insertMention = (
  text: string,
  start: number,
  caret: number,
  name: string
) => {
  const inserted = `@${name} `;
  return {
    caret: start + inserted.length,
    text: `${Str.slice(0, start)(text)}${inserted}${Str.slice(caret)(text)}`,
  };
};

/**
 * The mentions a message sends: each picked one whose `@name` the text still
 * holds, each once, at most MENTION_LIMIT. A picked name the writer deleted is
 * not sent.
 */
export const keptMentions = (
  text: string,
  picked: readonly (typeof MentionView.Type)[]
) =>
  Arr.take(
    Arr.dedupeWith(
      Arr.filter(picked, (mention) =>
        text.includes(
          mention._tag === "everyone" ? "@everyone" : `@${mention.name}`
        )
      ),
      (self: typeof MentionView.Type, that: typeof MentionView.Type) =>
        self._tag === that._tag &&
        (self._tag === "everyone" ||
          (that._tag === "person" && self.id === that.id))
    ),
    MENTION_LIMIT
  );

/** One piece of a message's text, with where it starts: plain text, or a mention that the message names. */
const Segment = Schema.Union([
  Schema.TaggedStruct("text", { at: Schema.Int, text: Schema.String }),
  Schema.TaggedStruct("mention", { at: Schema.Int, text: Schema.String }),
]);

/** The longest token first, so a name that holds another is matched whole. */
const byLength = Order.mapInput(
  Order.flip(Order.Number),
  (token: string) => token.length
);

/** Cuts a text, which starts at `offset` of the message, at the earliest token it holds, then cuts the rest the same way. */
const cut = (
  text: string,
  tokens: readonly string[],
  offset: number
): readonly (typeof Segment.Type)[] => {
  const hits = Arr.flatMap(tokens, (token) => {
    const at = text.indexOf(token);
    return at < 0 ? [] : [{ at, token }];
  });
  return Arr.match(hits, {
    onEmpty: () =>
      text === "" ? [] : [{ _tag: "text" as const, at: offset, text }],
    onNonEmpty: (found) => {
      // The tokens are longest first, so the first hit at the earliest place is the longest one there.
      const earliest = Arr.reduce(
        found,
        Arr.headNonEmpty(found),
        (best, hit) => (hit.at < best.at ? hit : best)
      );
      const after = earliest.at + earliest.token.length;
      return [
        ...(earliest.at > 0
          ? [
              {
                _tag: "text" as const,
                at: offset,
                text: text.slice(0, earliest.at),
              },
            ]
          : []),
        {
          _tag: "mention" as const,
          at: offset + earliest.at,
          text: earliest.token,
        },
        ...cut(text.slice(after), tokens, offset + after),
      ];
    },
  });
};

/**
 * The text of a message cut into plain pieces and the mentions it names, so each
 * mention shows apart. The longest name is matched first, so a name that holds
 * another is never cut short.
 */
export const mentionSegments = (
  text: string,
  mentions: readonly (typeof MentionView.Type)[]
) =>
  cut(
    text,
    Arr.sort(
      Arr.dedupe(
        Arr.map(mentions, (mention) =>
          mention._tag === "everyone" ? "@everyone" : `@${mention.name}`
        )
      ),
      byLength
    ),
    0
  );
