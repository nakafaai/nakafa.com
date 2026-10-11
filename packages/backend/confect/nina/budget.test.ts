import { describe, expect, it } from "@effect/vitest";
import {
  boundText,
  countFileTokens,
  countTextTokens,
} from "@repo/backend/confect/nina/budget";
import { Array as Arr } from "effect";

const SHORTENED_NOTE =
  /\n\n\[Shortened to about 200 of \d+ tokens\. Read the next section\.\]$/;

describe("Nina file tokens", () => {
  it.each([
    ["a png image, of any size", "image/png", 1120],
    ["a jpeg image", "image/jpeg", 1120],
    ["a webp image", "image/webp", 1120],
    ["a gif image", "image/gif", 1120],
    [
      "a pdf as one page, since no stored page count exists",
      "application/pdf",
      560,
    ],
    ["a text file as one page, since no stored size exists", "text/plain", 560],
  ] as const)("counts %s", (_name, mediaType, expected) => {
    expect(countFileTokens(mediaType)).toBe(expected);
  });
});

describe("Nina token budgets", () => {
  it("returns text that already fits unchanged", () => {
    const text = "A short explanation of limits.";
    expect(boundText(text, 100, "Read more.")).toBe(text);
  });

  it("cuts long text on a paragraph boundary and explains the omission", () => {
    const paragraph = "Limits describe values a function approaches. ".repeat(
      12
    );
    const text = Arr.join([paragraph, paragraph, paragraph, paragraph], "\n\n");
    const bounded = boundText(text, 200, "Read the next section.");
    expect(countTextTokens(bounded)).toBeLessThanOrEqual(200);
    expect(bounded).toMatch(SHORTENED_NOTE);
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
