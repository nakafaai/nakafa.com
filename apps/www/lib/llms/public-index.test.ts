// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import { AGENT_MARKDOWN_DIRECTIVE } from "@/lib/llms/format";
import {
  buildPublicLlmsAppSectionIndexText,
  buildRootLlmsIndexText,
  getPublicLlmsSectionIndexLines,
  resolvePublicLlmsSectionIndex,
} from "@/lib/llms/public-index";

describe("public llms discovery indexes", () => {
  it("builds a constant root with specific usage and developer guidance", () => {
    const text = buildRootLlmsIndexText();

    expect(text.startsWith("# Nakafa\n\n> ")).toBe(true);
    expect(text).toContain(`${BASE_URL}/en/llms.txt`);
    expect(text).toContain(`${BASE_URL}/id/llms.txt`);
    expect(text).not.toContain(`${BASE_URL}/llms/en`);
    expect(text).not.toContain("/page/");
    expect(text).toContain("https://mcp.nakafa.com/mcp");
    expect(text).toContain(`${BASE_URL}/skill.md`);
    expect(text).toContain("## When to use Nakafa");
    expect(text).toContain(`${BASE_URL}/developers/llms.txt`);
    expect(text).toContain(`Nakafa OpenAPI 3.1: \`${BASE_URL}/openapi.json\``);
    expect(text).not.toContain(
      `[Nakafa OpenAPI 3.1](${BASE_URL}/openapi.json)`
    );
    expect(text).toContain("read-only");
    expect(text).toContain("only when it includes `markdown_url`");
    expect(text).toContain("without requesting private attempt content");
  });

  it("derives localized nested indexes from canonical route surfaces", () => {
    const englishLines = getPublicLlmsSectionIndexLines("en");
    const indonesianLines = getPublicLlmsSectionIndexLines("id");

    expect(englishLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/en/subjects/llms.txt`)
    );
    expect(englishLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/en/curriculum/llms.txt`)
    );
    expect(indonesianLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/id/materi/llms.txt`)
    );
    expect(indonesianLines).toContainEqual(
      expect.stringContaining(`${BASE_URL}/id/kurikulum/llms.txt`)
    );
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
