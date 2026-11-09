import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import type { SearchEntry } from "@/lib/search/entry";
import {
  classifyPath,
  readExamEntries,
  readPageEntry,
} from "@/lib/search/page";

/** A page's HTML holding these structured data blocks, as the prerender writes them. */
function page(...blocks: readonly string[]) {
  return `<html><head>${blocks
    .map((block) => `<script type="application/ld+json">${block}</script>`)
    .join("")}</head><body></body></html>`;
}

/** A breadcrumb of these names and paths under the production origin. */
function breadcrumb(...crumbs: readonly (readonly [string, string])[]) {
  return JSON.stringify({
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, path], index) => ({
      "@type": "ListItem",
      item: `https://nakafa.com${path}`,
      name,
      position: index + 1,
    })),
  });
}

const FLAGS = { indonesia: "ID", merdeka: "ID" };

describe("classifyPath", () => {
  it("reads the kind from the family and the depth, in every spelling", () => {
    expect(classifyPath("de", "/de/lehrplaene")).toBe("hub");
    expect(classifyPath("en", "/en/curriculum/merdeka")).toBe("curriculum");
    expect(classifyPath("id", "/id/kurikulum/merdeka/kelas-10")).toBe("level");
    expect(
      classifyPath("en", "/en/curriculum/merdeka/class-10/chemistry")
    ).toBe("subject");
    expect(classifyPath("id", "/id/materi/kimia/atom/dalton")).toBe("lesson");
    expect(classifyPath("en", "/en/try-out/indonesia")).toBe("country");
    expect(classifyPath("en", "/en/try-out/indonesia/snbt")).toBe("exam");
    expect(classifyPath("en", "/en/try-out/indonesia/snbt/2027/set-1")).toBe(
      "tryout"
    );
    expect(classifyPath("en", "/en/quran/2")).toBe("surah");
    expect(classifyPath("en", "/en/articles/politics")).toBe("category");
    expect(classifyPath("en", "/en/articles/politics/cabinet")).toBe("article");
    expect(classifyPath("en", "/en/pricing")).toBe("page");
    expect(classifyPath("en", "/en/quran/2/extra")).toBe("page");
    expect(classifyPath("en", "/en")).toBe("page");
  });
});

describe("readPageEntry", () => {
  it("reads a lesson's title and trail, and the other curricula that teach it", () => {
    const html = page(
      '{"@type":"WebSite","name":"Nakafa"}',
      `[${JSON.stringify({
        "@type": "LearningResource",
        educationalAlignment: [
          { educationalFramework: "Kurikulum Merdeka" },
          { educationalFramework: "Cambridge International" },
          { educationalFramework: "Cambridge International" },
        ],
      })},${breadcrumb(
        ["Home", "/en"],
        ["Kurikulum Merdeka", "/en/curriculum/merdeka"],
        ["Class 10", "/en/curriculum/merdeka/class-10"],
        ["Chemistry", "/en/curriculum/merdeka/class-10/chemistry"],
        ["Dalton's Atomic Theory", "/en/subjects/chemistry/atom/dalton"]
      )}]`
    );
    expect(
      readPageEntry({
        flags: FLAGS,
        html,
        locale: "en",
        path: "/en/subjects/chemistry/atom/dalton",
      })
    ).toEqual(
      Option.some({
        kind: "lesson",
        path: "/en/subjects/chemistry/atom/dalton",
        terms: ["Cambridge International"],
        title: "Dalton's Atomic Theory",
        trail: ["Kurikulum Merdeka", "Class 10", "Chemistry"],
      })
    );
  });

  it("drops the family's own page from a trail, and draws a curriculum's flag", () => {
    const html = page(
      breadcrumb(
        ["Startseite", "/de"],
        ["Fächer", "/de/lehrplaene"],
        ["Kurikulum Merdeka", "/de/lehrplaene/merdeka"]
      )
    );
    expect(
      readPageEntry({
        flags: FLAGS,
        html,
        locale: "de",
        path: "/de/lehrplaene/merdeka",
      })
    ).toEqual(
      Option.some({
        flag: "ID",
        kind: "curriculum",
        path: "/de/lehrplaene/merdeka",
        title: "Kurikulum Merdeka",
        trail: [],
      })
    );
  });

  it("names a surah by its meaning and its number", () => {
    const html = page(
      JSON.stringify({
        "@type": "Chapter",
        alternateName: "The Cow",
        position: 2,
      }),
      breadcrumb(
        ["Home", "/en"],
        ["Quran", "/en/quran"],
        ["Al-Baqara", "/en/quran/2"]
      )
    );
    expect(
      readPageEntry({ flags: FLAGS, html, locale: "en", path: "/en/quran/2" })
    ).toEqual(
      Option.some({
        kind: "surah",
        path: "/en/quran/2",
        terms: ["The Cow", "2"],
        title: "Al-Baqara",
        trail: [],
      })
    );
  });

  it("keeps a page's parent that is no family, and leaves a country without a known flag plain", () => {
    expect(
      readPageEntry({
        flags: FLAGS,
        html: page(
          breadcrumb(
            ["Home", "/en"],
            ["School", "/en/school"],
            ["Pricing", "/en/school/pricing"]
          )
        ),
        locale: "en",
        path: "/en/school/pricing",
      })
    ).toEqual(
      Option.some({
        kind: "page",
        path: "/en/school/pricing",
        title: "Pricing",
        trail: ["School"],
      })
    );
    expect(
      Option.map(
        readPageEntry({
          flags: FLAGS,
          html: page(
            breadcrumb(
              ["Home", "/en"],
              ["Try out", "/en/try-out"],
              ["Germany", "/en/try-out/germany"]
            )
          ),
          locale: "en",
          path: "/en/try-out/germany",
        }),
        (entry) => entry.flag
      )
    ).toEqual(Option.some(undefined));
  });

  it("skips a page with no breadcrumb, and a block that is no JSON", () => {
    expect(
      readPageEntry({
        flags: FLAGS,
        html: page("{not json", '{"@type":"WebSite"}'),
        locale: "en",
        path: "/en",
      })
    ).toEqual(Option.none());
  });
});

describe("readExamEntries", () => {
  it("names each exam from the pages under it and opens the shallowest of them", () => {
    const entries: readonly SearchEntry[] = [
      {
        kind: "country",
        path: "/en/try-out/indonesia",
        title: "Indonesia",
        trail: [],
      },
      {
        kind: "tryout",
        path: "/en/try-out/indonesia/snbt/2027/utbk/set-1",
        title: "Set 1",
        trail: ["Indonesia", "SNBT", "Year 2027", "UTBK"],
      },
      {
        kind: "tryout",
        path: "/en/try-out/indonesia/snbt/2027",
        title: "Year 2027",
        trail: ["Indonesia", "SNBT"],
      },
      {
        kind: "tryout",
        path: "/en/try-out/indonesia/tka/high/english",
        title: "English",
        trail: ["Indonesia", "TKA", "Senior High School"],
      },
      {
        kind: "tryout",
        path: "/en/try-out/indonesia/tka/middle",
        title: "Junior High School",
        trail: ["Indonesia", "TKA"],
      },
      {
        kind: "tryout",
        path: "/en/try-out/indonesia/tka/high",
        title: "Senior High School",
        trail: ["Indonesia", "TKA"],
      },
      {
        kind: "exam",
        path: "/en/try-out/germany/entrance",
        title: "Entrance",
        trail: ["Germany"],
      },
      {
        kind: "tryout",
        path: "/en/try-out/germany/entrance/darmstadt",
        title: "Darmstadt",
        trail: ["Germany", "Entrance"],
      },
      {
        kind: "tryout",
        path: "/en/try-out/odd/x/y",
        title: "Y",
        trail: ["Odd"],
      },
    ];
    expect(readExamEntries(entries)).toEqual([
      {
        kind: "exam",
        path: "/en/try-out/indonesia/snbt/2027",
        title: "SNBT",
        trail: ["Indonesia"],
      },
      {
        kind: "exam",
        path: "/en/try-out/indonesia/tka/high",
        title: "TKA",
        trail: ["Indonesia"],
      },
    ]);
  });
});
