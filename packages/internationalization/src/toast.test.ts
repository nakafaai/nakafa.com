import { describe, expect, it } from "@effect/vitest";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import {
  characterCount,
  lineCount,
  overlongToastCopy,
  overlongToastParts,
  TOAST_DESCRIPTION_LINE_CHARACTERS,
  TOAST_DESCRIPTION_LINES,
  TOAST_TITLE_LINE_CHARACTERS,
  TOAST_TITLE_LINES,
  type ToastCopyText,
  ToastValueKeySchema,
  ToastValuesSchema,
} from "@repo/internationalization/src/toast";
import { Array as Arr, Record as Rec, Schema } from "effect";

/** The locales that have a dictionary, so each one's messages can be loaded. */
const Locales = Schema.Literals(["de", "en", "id"]);

/** A namespace of the app's messages, which holds messages or namespaces. */
const MessageNamespaceSchema = Schema.Record(Schema.String, Schema.Unknown);

/** A placeholder of a message, such as `{size, number}`, with its name in the first group. */
const PLACEHOLDER = /\{(\w+)(?:,[^}]*)?\}/gu;

/** The names of the placeholders in one message, such as `size` in `{size, number}`. */
function placeholdersIn(text: string) {
  return Arr.flatMap(Arr.fromIterable(text.matchAll(PLACEHOLDER)), (match) => [
    match[1],
  ]);
}

/** The placeholder names of every title and description in a toast namespace. */
function placeholdersOf(namespace: Readonly<Record<string, ToastCopyText>>) {
  return Arr.flatMap(Rec.values(namespace), (copy) =>
    Arr.flatMap([copy.title, copy.description ?? ""], placeholdersIn)
  );
}

/** Every message under a node of the app's messages, at any depth. */
function messagesOf(node: unknown): readonly string[] {
  if (typeof node === "string") {
    return [node];
  }
  return Schema.is(MessageNamespaceSchema)(node)
    ? Arr.flatMap(Rec.values(node), messagesOf)
    : [];
}

/**
 * The text each toast copy shows as a whole: its title alone, or its title and
 * its description after it.
 */
function wholeCopiesOf(namespace: Readonly<Record<string, ToastCopyText>>) {
  return Arr.map(Rec.values(namespace), (copy) =>
    copy.description === undefined
      ? copy.title
      : `${copy.title} ${copy.description}`
  );
}

/**
 * The keys of the messages in a toast namespace that interpolate a value: each
 * title or description that has a placeholder.
 */
function interpolatingKeysOf(
  namespace: Readonly<Record<string, ToastCopyText>>
) {
  return Arr.flatMap(Rec.toEntries(namespace), ([name, copy]) =>
    Arr.flatMap(
      [
        { key: `${name}.title`, text: copy.title },
        { key: `${name}.description`, text: copy.description ?? "" },
      ],
      ({ key, text }) => (placeholdersIn(text).length > 0 ? [key] : [])
    )
  );
}

describe("toast copy at 320px", () => {
  it("keeps every German title on one line and every description on two", () => {
    expect(overlongToastCopy(de.Toast)).toEqual([]);
  });

  it("keeps every English title on one line and every description on two", () => {
    expect(overlongToastCopy(en.Toast)).toEqual([]);
  });

  it("keeps every Indonesian title on one line and every description on two", () => {
    expect(overlongToastCopy(id.Toast)).toEqual([]);
  });

  it("gives every locale the same toast copy keys, so no toast is missing a language", () => {
    expect(Arr.difference(Rec.keys(en.Toast), Rec.keys(de.Toast))).toEqual([]);
    expect(Arr.difference(Rec.keys(de.Toast), Rec.keys(en.Toast))).toEqual([]);
    expect(Arr.difference(Rec.keys(en.Toast), Rec.keys(id.Toast))).toEqual([]);
    expect(Arr.difference(Rec.keys(id.Toast), Rec.keys(en.Toast))).toEqual([]);
  });

  it("reports a title that wraps past its one line, and nothing for a title on it", () => {
    expect(
      overlongToastParts({
        title: "x".repeat(TOAST_TITLE_LINE_CHARACTERS + 1),
      })
    ).toEqual([{ limit: TOAST_TITLE_LINES, lines: 2, part: "title" }]);
    expect(
      overlongToastParts({ title: "x".repeat(TOAST_TITLE_LINE_CHARACTERS) })
    ).toEqual([]);
  });

  it("wraps a title by its words, so two words that do not fit one line are two lines", () => {
    const fits = `${"x".repeat(18)} ${"x".repeat(17)}`;
    const wraps = `${"x".repeat(20)} ${"x".repeat(16)}`;

    expect(fits.length).toBe(TOAST_TITLE_LINE_CHARACTERS);
    expect(overlongToastParts({ title: fits })).toEqual([]);
    expect(overlongToastParts({ title: wraps })).toEqual([
      { limit: TOAST_TITLE_LINES, lines: 2, part: "title" },
    ]);
  });

  it("counts a description by the lines its words fill, not by its characters", () => {
    // Two 20-letter words do not share a 37-character line, so each one is a line.
    const threeLines = `${"x".repeat(20)} ${"x".repeat(20)} ${"x".repeat(20)}`;
    // Two 18-letter words share one line, so these three words take two.
    const twoLines = `${"x".repeat(18)} ${"x".repeat(18)} ${"x".repeat(18)}`;

    expect(threeLines.length).toBeLessThan(
      TOAST_DESCRIPTION_LINE_CHARACTERS * TOAST_DESCRIPTION_LINES
    );
    expect(
      overlongToastParts({ description: threeLines, title: "Saved." })
    ).toEqual([
      { limit: TOAST_DESCRIPTION_LINES, lines: 3, part: "description" },
    ]);
    expect(
      overlongToastParts({ description: twoLines, title: "Saved." })
    ).toEqual([]);
  });

  it("gives a word longer than a line its own lines, and the word after it a new one", () => {
    const longWord = "x".repeat(TOAST_DESCRIPTION_LINE_CHARACTERS + 1);

    expect(lineCount(longWord, TOAST_DESCRIPTION_LINE_CHARACTERS)).toBe(2);
    expect(lineCount(`${longWord} y`, TOAST_DESCRIPTION_LINE_CHARACTERS)).toBe(
      3
    );
  });

  it("measures no description and an empty text as no lines", () => {
    expect(lineCount("", TOAST_DESCRIPTION_LINE_CHARACTERS)).toBe(0);
    expect(overlongToastParts({ title: "Saved." })).toEqual([]);
  });

  it("names the key of each copy that does not fit", () => {
    expect(
      overlongToastCopy({
        "too-long": { title: "x".repeat(TOAST_TITLE_LINE_CHARACTERS + 1) },
      })
    ).toEqual([
      {
        key: "too-long",
        limit: TOAST_TITLE_LINES,
        lines: 2,
        part: "title",
      },
    ]);
  });

  it("counts a letter with an accent or an emoji as one character", () => {
    expect(characterCount("Ñandú 👍")).toBe(7);
  });

  it("names every placeholder of a toast message in the values the Toaster passes", () => {
    const names = Arr.flatMap([de.Toast, en.Toast, id.Toast], placeholdersOf);

    expect(names).toContain("size");
    expect(Arr.difference(names, Rec.keys(ToastValuesSchema.fields))).toEqual(
      []
    );
  });

  it("lists exactly the messages that interpolate a value as the keys that take values, in every locale", () => {
    const unlisted = Arr.flatMap(
      [de.Toast, en.Toast, id.Toast],
      (namespace) => {
        const keys = interpolatingKeysOf(namespace);

        return [
          ...Arr.difference(keys, ToastValueKeySchema.literals),
          ...Arr.difference(ToastValueKeySchema.literals, keys),
        ];
      }
    );

    expect(unlisted).toEqual([]);
  });
});

describe("toast copy has one owner", () => {
  it.each(Locales.literals)(
    "names no message of the app in %s that repeats the whole copy of a toast",
    async (locale) => {
      const { Toast, ...messages } = await loadLocaleMessages(locale);

      expect(
        Arr.intersection(wholeCopiesOf(Toast), messagesOf(messages))
      ).toEqual([]);
    }
  );
});
