import { describe, expect, it } from "@effect/vitest";
import { boundText, countTextTokens } from "@repo/backend/confect/nina/budget";

describe("Nina token budgets", () => {
  it("returns text that already fits unchanged", () => {
    const text = "A short explanation of limits.";
    expect(boundText(text, 100, "Read more.")).toBe(text);
  });

  it("cuts long text on a paragraph boundary and explains the omission", () => {
    const paragraph = "Limits describe values a function approaches. ".repeat(
      12
    );
    const text = [paragraph, paragraph, paragraph, paragraph].join("\n\n");
    const bounded = boundText(text, 200, "Read the next section.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(200);
    expect(bounded).toMatch(
      /\n\n\[Shortened to about 200 of \d+ tokens\. Read the next section\.\]$/
    );
    expect(text.startsWith(bounded.slice(0, bounded.indexOf("\n\n[")))).toBe(
      true
    );
  });

  it("keeps the token cut when no boundary is close", () => {
    const text = "word ".repeat(600);
    const bounded = boundText(text, 150, "Narrow the request.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(150);
    expect(bounded).toContain("Narrow the request.");
  });
});
