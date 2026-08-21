import { describe, expect, it } from "vitest";
import {
  getCanonicalCurrentPageContentUrl,
  isVerifiableContentPath,
} from "@/app/api/chat/content";

describe("app/api/chat/content", () => {
  it("builds the canonical current-page URL from locale and slug", () => {
    expect(
      getCanonicalCurrentPageContentUrl({
        locale: "id",
        slug: "/materi/matematika/aljabar/",
      })
    ).toBe("https://nakafa.com/id/materi/matematika/aljabar");
  });

  it.each([
    "/articles/politics/example",
    "/quran/1",
    "/curriculum/merdeka/class-10",
    "/kurikulum/merdeka/kelas-10",
    "/lehrplaene/merdeka/klasse-10",
    "/subjects/mathematics/functions/example",
    "/materi/matematika/fungsi/example",
    "/faecher/mathematik/funktionen/beispiel",
  ])("recognizes every localized verified content namespace in %s", (path) => {
    expect(isVerifiableContentPath(path)).toBe(true);
  });

  it.each(["/", "/chat", "/privacy-policy", "/try-out/indonesia/snbt"])(
    "keeps non-learning path %s outside content verification",
    (path) => {
      expect(isVerifiableContentPath(path)).toBe(false);
    }
  );
});
