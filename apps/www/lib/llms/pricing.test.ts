// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { BASE_URL } from "@/lib/llms/constants";
import { AGENT_MARKDOWN_DIRECTIVE } from "@/lib/llms/format";
import { getPricingLlmsText, isPricingLlmsRoute } from "@/lib/llms/pricing";

describe("pricing Markdown", () => {
  it("owns only the pricing route", () => {
    expect(isPricingLlmsRoute("pricing")).toBe(true);
    expect(isPricingLlmsRoute("pricing/annual")).toBe(false);
    expect(isPricingLlmsRoute("about")).toBe(false);
  });

  it.effect(
    "writes the checkout line in German and Indonesian, not in English",
    () =>
      Effect.gen(function* () {
        const german = yield* getPricingLlmsText("de");
        const indonesian = yield* getPricingLlmsText("id");

        expect(german).not.toContain("Current price and checkout");
        expect(indonesian).not.toContain("Current price and checkout");
      })
  );

  it.effect.each(["de", "en", "id"] as const)(
    "renders localized plans and all questions for %s",
    (locale) =>
      Effect.gen(function* () {
        const text = yield* getPricingLlmsText(locale);

        expect(text).toContain("# ");
        expect(text).toContain(AGENT_MARKDOWN_DIRECTIVE);
        expect(text).toContain(`URL: ${BASE_URL}/${locale}/pricing`);
        expect(text.match(/^### /gm)).toHaveLength(10);
        expect(text.match(/^## /gm)).toHaveLength(4);
        expect(text).not.toContain("<mark>");
        expect(text).not.toContain("undefined");
      })
  );

  it.effect("mirrors the visible English pricing structure", () =>
    Effect.gen(function* () {
      const text = yield* getPricingLlmsText("en");

      expect(text).toContain("## Free really means free");
      expect(text).toContain("- 3,000 credits every month to ask Nina");
      expect(text).toContain("## Frequently asked");
      expect(text).toContain("One answer uses 5 credits.");
      expect(text).toContain(
        `Current price and checkout: ${BASE_URL}/en/pricing`
      );
    })
  );
});
