import { describe, expect, it } from "@effect/vitest";
import { readAlternates } from "@repo/internationalization/src/alternates";

describe("alternate links", () => {
  it("lists every locale's spelling of a page, then x-default", () => {
    expect(readAlternates("/en/curricula")).toStrictEqual([
      { hreflang: "en", href: "https://nakafa.com/en/curriculum" },
      { hreflang: "id", href: "https://nakafa.com/id/kurikulum" },
      { hreflang: "de", href: "https://nakafa.com/de/lehrplaene" },
      { hreflang: "x-default", href: "https://nakafa.com/en/curriculum" },
    ]);
  });

  it("writes every locale's material with the same subject", () => {
    expect(readAlternates("/de/materials/matematika")).toStrictEqual([
      { hreflang: "en", href: "https://nakafa.com/en/subjects/matematika" },
      { hreflang: "id", href: "https://nakafa.com/id/materi/matematika" },
      { hreflang: "de", href: "https://nakafa.com/de/faecher/matematika" },
      {
        hreflang: "x-default",
        href: "https://nakafa.com/en/subjects/matematika",
      },
    ]);
  });
});
