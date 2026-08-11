// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getTryoutExamSocialImage } from "@/lib/tryout/social-images";

describe("try-out social images", () => {
  it.each([
    ["en", "snbt", "/open-graph/tryout/indonesia/en-snbt.png"],
    ["en", "tka", "/open-graph/tryout/indonesia/en-tka.png"],
    ["id", "snbt", "/open-graph/tryout/indonesia/id-snbt.png"],
    ["id", "tka", "/open-graph/tryout/indonesia/id-tka.png"],
  ] as const)(
    "resolves the %s %s exam artwork",
    (locale, examKey, expected) => {
      expect(
        getTryoutExamSocialImage({
          countryKey: "indonesia",
          examKey,
          locale,
          publicPath: `try-out/indonesia/${examKey}`,
        })
      ).toBe(expected);
    }
  );

  it("keeps generated images for future exams", () => {
    expect(
      getTryoutExamSocialImage({
        countryKey: "indonesia",
        examKey: "future-exam",
        locale: "en",
        publicPath: "try-out/indonesia/future-exam",
      })
    ).toBe("/en/og/try-out/indonesia/future-exam/image.png");
  });

  it("keeps generated images for the same exam key outside Indonesia", () => {
    expect(
      getTryoutExamSocialImage({
        countryKey: "germany",
        examKey: "snbt",
        locale: "en",
        publicPath: "try-out/germany/snbt",
      })
    ).toBe("/en/og/try-out/germany/snbt/image.png");
  });
});
