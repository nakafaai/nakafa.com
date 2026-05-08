import type { AgentContext } from "@repo/ai/types/agents";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  isNumericString,
  normalizeMaterialSlug,
  resolveMaterialInput,
} from "./input";

const context = {
  needsPageFetch: true,
  slug: "subject/high-school/11/mathematics/function-modeling/rational-function",
  url: "/id/subject/high-school/11/mathematics/function-modeling/rational-function",
  verified: true,
} satisfies AgentContext;

describe("material/input", () => {
  it("uses the model input when no page fetch is pending", () => {
    const input = { locale: "en", slug: "/articles/mathematics" } as const;

    expect(
      Effect.runSync(
        resolveMaterialInput({
          context,
          input,
          locale: "id",
          usePageInput: false,
        })
      )
    ).toEqual(input);
  });

  it("uses the server-verified page input for a pending page fetch", () => {
    expect(
      Effect.runSync(
        resolveMaterialInput({
          context,
          input: { locale: "en", slug: "/articles/mathematics" },
          locale: "id",
          usePageInput: true,
        })
      )
    ).toEqual({
      locale: "id",
      slug: context.slug,
    });
  });

  it.each([
    ["/id/subject/algebra", "subject/algebra"],
    ["id", ""],
    ["subject/algebra", "subject/algebra"],
  ] as const)("normalizes %s", (slug, expected) => {
    expect(Effect.runSync(normalizeMaterialSlug({ slug, locale: "id" }))).toBe(
      expected
    );
  });

  it.each([
    ["10", true],
    [" 10 ", true],
    ["01", false],
    ["10a", false],
    ["", false],
  ] as const)("checks numeric slug segment %s", (value, expected) => {
    expect(isNumericString(value)).toBe(expected);
  });
});
