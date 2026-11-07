// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { BASE_URL } from "@/lib/llms/constants";
import { AGENT_MARKDOWN_DIRECTIVE } from "@/lib/llms/format";
import { getSchoolLlmsText, isSchoolLlmsRoute } from "@/lib/llms/school";

describe("School Markdown", () => {
  it("owns only the School landing and its pricing", () => {
    expect(isSchoolLlmsRoute("school")).toBe(true);
    expect(isSchoolLlmsRoute("school/pricing")).toBe(true);
    expect(isSchoolLlmsRoute("school/new")).toBe(false);
    expect(isSchoolLlmsRoute("pricing")).toBe(false);
  });

  it.effect.each(["de", "en", "id"] as const)(
    "states every plan, period, add-on and question of the pricing page in %s",
    (locale) =>
      Effect.gen(function* () {
        const text = yield* getSchoolLlmsText(locale, "school/pricing");

        expect(text).toContain(AGENT_MARKDOWN_DIRECTIVE);
        expect(text).toContain(`URL: ${BASE_URL}/${locale}/school/pricing`);
        expect(text).toContain("Rp 1.790.000");
        expect(text).toContain("Rp 91.086.000");
        expect(text).toContain("$5,688.60");
        expect(text).toContain("Rp 15.900");
        expect(text.match(/^### /gmu)).toHaveLength(3 + 7);
      })
  );

  it.effect("adds the features and the trial link to the landing", () =>
    Effect.gen(function* () {
      const text = yield* getSchoolLlmsText("en", "school");

      expect(text).toContain(`URL: ${BASE_URL}/en/school`);
      expect(text).toContain("- Forum: ");
      expect(text).toContain(`(${BASE_URL}/en/school/new)`);
      expect(text.match(/^### /gmu)).toHaveLength(3 + 5);
    })
  );
});
