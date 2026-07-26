// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  getLlmsSections,
  getSiteLlmsEntries,
  isLlmsSection,
} from "@/lib/llms/entries";

describe("llms entries", () => {
  it("classifies supported sections", () => {
    expect(isLlmsSection("articles")).toBe(true);
    expect(isLlmsSection("unknown")).toBe(false);
    expect(isLlmsSection(undefined)).toBe(false);
    expect(getLlmsSections()).toEqual([
      "articles",
      "material",
      "quran",
      "site",
    ]);
  });

  it("localizes static site routes", () => {
    const englishEntries = getSiteLlmsEntries("en");
    const indonesianEntries = getSiteLlmsEntries("id");
    const englishCurriculum = englishEntries.find(
      (entry) => entry.route === "/curriculum"
    );
    const indonesianCurriculum = indonesianEntries.find(
      (entry) => entry.route === "/kurikulum"
    );

    expect(englishCurriculum).toMatchObject({
      href: `${BASE_URL}/en/curriculum`,
      section: "site",
      title: "Curriculum",
    });
    expect(indonesianCurriculum).toMatchObject({
      href: `${BASE_URL}/id/kurikulum`,
      section: "site",
      title: "Kurikulum",
    });
    expect(englishEntries.map((entry) => entry.route)).toEqual([
      "/curriculum",
      "/privacy-policy",
      "/security-policy",
      "/terms-of-service",
    ]);
    expect(englishEntries.some((entry) => entry.route === "/")).toBe(false);
    expect(englishEntries.some((entry) => entry.route === "/contributor")).toBe(
      false
    );
    expect(englishEntries.some((entry) => entry.route === "/search")).toBe(
      false
    );
  });
});
