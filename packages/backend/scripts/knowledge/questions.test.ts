import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { questionsFor } from "@repo/backend/scripts/knowledge/questions";
import { Array as Arr, HashSet, String as Str } from "effect";

const VERSES_HEADING = /^Verses \d+-\d+$/u;

/** The place a question labels, which is the same in every language. */
const placeOf = ({
  contentKey,
  ordinal,
}: ReturnType<typeof questionsFor>[number]) => `${contentKey}#${ordinal}`;

describe("model test questions", () => {
  it.each(ACTIVE_APP_LOCALE_CODES)(
    "asks at least thirty questions in %s",
    (locale) => {
      expect(Arr.length(questionsFor(locale))).toBeGreaterThanOrEqual(30);
    }
  );

  it("asks the same questions in every language, about the same sections", () => {
    const [first, ...others] = Arr.map(ACTIVE_APP_LOCALE_CODES, (locale) =>
      Arr.map(questionsFor(locale), placeOf)
    );
    for (const places of others) {
      expect(places).toEqual(first);
    }
  });

  it("labels each section once", () => {
    const places = Arr.map(questionsFor("en"), placeOf);
    expect(HashSet.size(HashSet.fromIterable(places))).toBe(Arr.length(places));
  });

  it("writes every question and every heading in words", () => {
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      for (const { heading, question } of questionsFor(locale)) {
        expect(Str.isNonEmpty(Str.trim(heading))).toBe(true);
        expect(Str.endsWith("?")(question)).toBe(true);
      }
    }
  });

  it("gives the question and the heading of the language it is asked for", () => {
    const [indonesian] = questionsFor("id");
    const [german] = questionsFor("de");
    expect(indonesian).toMatchObject({
      contentKey: "material/lesson/physics/kinematics/uniform-circular-motion",
      heading: "Percepatan Sentripetal Selalu Menuju Pusat",
      ordinal: 6,
      question:
        "Pada gerak melingkar dengan laju tetap, ke arah mana percepatannya?",
    });
    expect(german?.heading).toBe(
      "Zentripetalbeschleunigung zeigt immer nach innen"
    );
  });

  it("labels the passages of the Quran by the verses they hold", () => {
    const passages = Arr.filter(questionsFor("en"), ({ contentKey }) =>
      Str.startsWith("quran/")(contentKey)
    );
    expect(Arr.length(passages)).toBeGreaterThan(0);
    for (const { heading } of passages) {
      expect(heading).toMatch(VERSES_HEADING);
    }
  });
});
