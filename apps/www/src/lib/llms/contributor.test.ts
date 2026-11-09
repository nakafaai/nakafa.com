// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { contributors } from "@/lib/data/contributor";
import { BASE_URL } from "@/lib/llms/constants";
import { AGENT_MARKDOWN_DIRECTIVE } from "@/lib/llms/format";
import {
  getContributorLlmsText,
  isContributorLlmsRoute,
} from "@/lib/llms/contributor";

describe("contributors Markdown", () => {
  it("owns only the contributors route", () => {
    expect(isContributorLlmsRoute("contributor")).toBe(true);
    expect(isContributorLlmsRoute("contributor/nabilfatih")).toBe(false);
    expect(isContributorLlmsRoute("pricing")).toBe(false);
  });

  it.effect.each(["de", "en", "id"] as const)(
    "names every contributor once with their role for %s",
    (locale) =>
      Effect.gen(function* () {
        const text = yield* getContributorLlmsText(locale);

        expect(text).toContain(AGENT_MARKDOWN_DIRECTIVE);
        expect(text).toContain(`URL: ${BASE_URL}/${locale}/contributor`);
        expect(text.match(/^- /gmu)).toHaveLength(contributors.length);
        for (const { name } of contributors) {
          expect(text).toContain(`- ${name}, `);
        }
        expect(text).not.toContain("undefined");
      })
  );

  it.effect(
    "lists the profiles a person shares, and none for a person who shares none",
    () =>
      Effect.gen(function* () {
        const lines = Arr.filter(
          (yield* getContributorLlmsText("en")).split("\n"),
          (line) => line.startsWith("- ")
        );

        expect(lines).toContain(
          "- Nabil Akbarazzima Fatih, Nakafa team: https://github.com/nabilfatih, https://www.linkedin.com/in/nabilfatih, https://x.com/nabilfatih_"
        );
        expect(
          Arr.filter(lines, (line) => !line.includes("https://"))
        ).toHaveLength(
          Arr.filter(contributors, (person) => person.social === undefined)
            .length
        );
      })
  );
});
