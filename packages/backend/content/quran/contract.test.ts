import { makeAppLocale } from "@nakafa/aksara-contracts/locale";
import {
  formatQuranMeaning,
  selectQuranMeaning,
} from "@repo/backend/content/quran/contract";
import { describe, expect, it } from "vitest";

describe("published Quran meaning selection", () => {
  it("selects every localized meaning from the current signed contract", () => {
    const meaning = {
      de: "Die Kuh",
      en: "The Cow",
      id: "Sapi",
    } as const;

    expect(selectQuranMeaning(meaning, "de")).toEqual({
      appLocale: "de",
      text: "Die Kuh",
    });
    expect(selectQuranMeaning(meaning, "en")).toEqual({
      appLocale: "en",
      text: "The Cow",
    });
    expect(selectQuranMeaning(meaning, "id")).toEqual({
      appLocale: "id",
      text: "Sapi",
    });
  });

  it("preserves the authenticated English language of a stored transition", () => {
    const meaning = { appLocale: makeAppLocale("en"), text: "The Cow" };

    expect(selectQuranMeaning(meaning, "id")).toEqual({
      appLocale: "en",
      text: "The Cow",
    });
    expect(formatQuranMeaning(meaning, "id")).toBe("The Cow (en)");
  });

  it("does not annotate a meaning selected in the requested locale", () => {
    const meaning = {
      de: "Die Kuh",
      en: "The Cow",
      id: "Sapi",
    } as const;

    expect(formatQuranMeaning(meaning, "de")).toBe("Die Kuh");
  });
});
