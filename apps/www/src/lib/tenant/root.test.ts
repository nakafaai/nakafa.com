// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { DEFAULT_LOCALE } from "@repo/internationalization/src/locale";
import { getRouteMessages } from "@repo/internationalization/src/messages";
import { Effect, Record } from "effect";
import {
  readSchoolLocale,
  readSchoolRoot,
  SchoolMessagesUnavailable,
} from "@/lib/tenant/root";

vi.mock("@repo/internationalization/src/messages", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/internationalization/src/messages")
    >();
  return { ...actual, getRouteMessages: vi.fn(actual.getRouteMessages) };
});

/** A browser whose preferred languages and document cookie the test chooses. */
function stubBrowser(languages: readonly string[], cookie: string) {
  vi.stubGlobal("navigator", { languages });
  vi.stubGlobal("document", { cookie });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readSchoolLocale", () => {
  it("reads the language cookie before the browser's preferred languages", () => {
    stubBrowser(["id-ID", "en"], "theme=dark; NAKAFA_LOCALE=de");
    expect(readSchoolLocale()).toBe("de");
  });

  it("reads the browser's preferred languages without a cookie", () => {
    stubBrowser(["id-ID", "en"], "");
    expect(readSchoolLocale()).toBe("id");
  });

  it("falls back to the default locale when no language is served", () => {
    stubBrowser(["fr-FR"], "");
    expect(readSchoolLocale()).toBe(DEFAULT_LOCALE);
  });
});

describe("readSchoolRoot", () => {
  it.effect(
    "answers the negotiated locale, only the school's messages, and the browser's instant",
    () =>
      Effect.gen(function* () {
        stubBrowser(["id-ID"], "");
        const root = yield* readSchoolRoot();
        expect(root.locale).toBe("id");
        expect(root.now).toBeInstanceOf(Date);
        expect(Record.keys(root.messages)).toStrictEqual(
          expect.arrayContaining([
            "School",
            "SchoolSettings",
            "Exams",
            "Common",
          ])
        );
        expect(Record.keys(root.messages)).not.toContain("Pricing");
      })
  );

  it.effect("fails with its own error when the dictionary cannot load", () =>
    Effect.gen(function* () {
      stubBrowser(["en"], "");
      vi.mocked(getRouteMessages).mockRejectedValueOnce(new Error("offline"));
      const failure = yield* readSchoolRoot().pipe(Effect.flip);
      expect(failure).toBeInstanceOf(SchoolMessagesUnavailable);
    })
  );
});
