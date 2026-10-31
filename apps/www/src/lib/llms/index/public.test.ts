// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";
import { BASE_URL } from "@/lib/llms/constants";
import { AGENT_MARKDOWN_DIRECTIVE } from "@/lib/llms/format";
import {
  buildPublicLlmsAppSectionIndexText,
  buildRootLlmsIndexText,
  getPublicLlmsSectionIndexLines,
  isPublicLlmsLocaleIndexRoute,
  resolvePublicLlmsSectionIndex,
} from "@/lib/llms/index/public";
import { buildLlmsSectionPageMapText } from "@/lib/llms/section";
import { buildUnsupportedMarkdownRouteText } from "@/lib/llms/unsupported";

/** Every llms index address in a text. */
function readIndexLinks(text: string) {
  return Arr.map(
    Arr.fromIterable(
      text.matchAll(/https:\/\/nakafa\.com\/[^\s)`]*llms\.txt/gu)
    ),
    ([link]) => new URL(link).pathname
  );
}

describe("public llms discovery indexes", () => {
  it("builds a constant root that links only locale aggregates", () => {
    const text = buildRootLlmsIndexText();

    expect(text.startsWith("# Nakafa\n\n> ")).toBe(true);
    expect(text).toContain(`${BASE_URL}/llms.mdx/en/llms.txt`);
    expect(text).toContain(`${BASE_URL}/llms.mdx/id/llms.txt`);
    expect(text).not.toContain(`${BASE_URL}/llms.mdx/llms/en`);
    expect(text).not.toContain("/page/");
    expect(text).toContain("https://mcp.nakafa.com/mcp");
    expect(text).toContain(`${BASE_URL}/skill.md`);
    expect(text).toContain(
      "\n## Use\n\n- Nakafa content is licensed under https://github.com/nakafaai/aksara/blob/main/CONTENT_LICENSE.md\n"
    );
    expect(text).toContain(
      "- Model training is reserved: https://nakafa.com/.well-known/tdmrep.json\n"
    );
  });

  it("derives localized nested indexes from canonical route surfaces", () => {
    const englishLines = getPublicLlmsSectionIndexLines("en");
    const indonesianLines = getPublicLlmsSectionIndexLines("id");

    expect(englishLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/llms.mdx/en/subjects/llms.txt`)
    );
    expect(englishLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/llms.mdx/en/curriculum/llms.txt`)
    );
    expect(indonesianLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/llms.mdx/id/materi/llms.txt`)
    );
    expect(indonesianLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/llms.mdx/id/kurikulum/llms.txt`)
    );
  });

  it("classifies only localized public locale-index slugs", () => {
    expect(isPublicLlmsLocaleIndexRoute("")).toBe(true);
    expect(isPublicLlmsLocaleIndexRoute("llms")).toBe(true);
    expect(isPublicLlmsLocaleIndexRoute("articles")).toBe(false);
    expect(isPublicLlmsLocaleIndexRoute("llms/en")).toBe(false);
  });

  it("resolves public prefixes to their bounded content sections", () => {
    expect(
      resolvePublicLlmsSectionIndex({
        cleanSlug: "subjects/llms",
        locale: "en",
      })
    ).toEqual({ label: "Material", prefix: "subjects", section: "material" });
    expect(
      resolvePublicLlmsSectionIndex({
        cleanSlug: "kurikulum/llms.txt",
        locale: "id",
      })
    ).toEqual({ label: "Curriculum", prefix: "kurikulum" });
    expect(
      resolvePublicLlmsSectionIndex({
        cleanSlug: "subjects/chemistry/llms",
        locale: "en",
      })
    ).toBeNull();
    expect(
      resolvePublicLlmsSectionIndex({ cleanSlug: "unknown", locale: "en" })
    ).toBeNull();
  });

  it("builds app-only indexes without content enumeration", () => {
    const text = buildPublicLlmsAppSectionIndexText({
      index: { label: "Curriculum", prefix: "curriculum" },
      locale: "en",
    });

    expect(text).toContain("# Nakafa English Curriculum");
    expect(text).toContain(`${BASE_URL}/en/curriculum`);
    expect(text).toContain(`${BASE_URL}/skill.md`);
    expect(text).toContain(AGENT_MARKDOWN_DIRECTIVE);
  });
});

describe("llms index links", () => {
  it("links every index only to an address that is served: the root file or the /llms.mdx route", () => {
    const links = Arr.flatMap(
      [
        buildRootLlmsIndexText(),
        ...Arr.map(LOCALES, (locale) =>
          Arr.join(getPublicLlmsSectionIndexLines(locale), "\n")
        ),
        ...Arr.map(LOCALES, (locale) =>
          buildUnsupportedMarkdownRouteText({ locale, route: "/zzz" })
        ),
        buildLlmsSectionPageMapText({
          locale: "en",
          pageCount: 3,
          routeCount: 9,
          section: "material",
        }),
      ],
      readIndexLinks
    );

    expect(links.length).toBeGreaterThan(LOCALES.length * 2);
    for (const link of links) {
      expect(link === "/llms.txt" || link.startsWith("/llms.mdx/"), link).toBe(
        true
      );
    }
  });
});
