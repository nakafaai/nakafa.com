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

  it.effect.each(["de", "en", "id"] as const)(
    "renders localized plans and all questions for %s",
    (locale) =>
      Effect.gen(function* () {
        const text = yield* getPricingLlmsText(locale);

        expect(text).toContain("# ");
        expect(text).toContain(AGENT_MARKDOWN_DIRECTIVE);
        expect(text).toContain(`URL: ${BASE_URL}/${locale}/pricing`);
        expect(text.match(/^### /gm)).toHaveLength(20);
        expect(text.match(/^## /gm)).toHaveLength(4);
        expect(text).not.toContain("<mark>");
        expect(text).not.toContain("undefined");
      })
  );

  it.effect("mirrors the visible English pricing structure", () =>
    Effect.gen(function* () {
      const text = yield* getPricingLlmsText("en");

      expect(text).toContain(
        "## Start with Free. Move to Pro when you are ready."
      );
      expect(text).toContain(
        "Compare both plans, then choose the one that fits how you learn."
      );
      expect(text).toContain("## Anything you want to check first?");
    })
  );
});
