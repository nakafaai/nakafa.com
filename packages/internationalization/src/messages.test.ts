import { describe, expect, it } from "@effect/vitest";
import appDe from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import appEn from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import appId from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import de from "@repo/internationalization/dictionaries/standalone/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/standalone/id.json" with {
  type: "json",
};
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Record as Rec } from "effect";

const app = { de: appDe, en: appEn, id: appId };
const standalone = { de, en, id };

/** Every word of a standalone dictionary, named by its namespace and its key. */
function wordsOf(
  dictionary: Readonly<Record<string, Readonly<Record<string, string>>>>
) {
  return Arr.flatMap(Rec.toEntries(dictionary), ([namespace, words]) =>
    Arr.map(Rec.keys(words), (key) => `${namespace}.${key}`)
  );
}

describe("loadLocaleMessages", () => {
  it.each(["de", "en", "id"] as const)(
    "gives the %s messages of the app and of the standalone pages as one set",
    async (locale) => {
      const messages = await loadLocaleMessages(locale);

      expect(messages).toMatchObject(standalone[locale]);
      expect(messages.Common.home).toBeTypeOf("string");
    }
  );
});

describe("the standalone dictionaries", () => {
  it.each(["de", "id"] as const)(
    "have in %s every word that the English one has, and no other",
    (locale) => {
      const words = wordsOf(standalone[locale]);
      const wanted = wordsOf(en);

      expect(Arr.difference(wanted, words)).toEqual([]);
      expect(Arr.difference(words, wanted)).toEqual([]);
    }
  );

  it.each(["de", "en", "id"] as const)(
    "share no namespace with the app dictionary in %s, which the two are joined without merging",
    (locale) => {
      const shared = Arr.intersection(
        Rec.keys(app[locale]),
        Rec.keys(standalone[locale])
      );

      expect(shared).toEqual([]);
    }
  );
});
