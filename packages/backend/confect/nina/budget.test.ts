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
    [
      "an image of unknown size, as the provider's 960 by 540 example",
      { mediaType: "image/png" },
      1548,
    ],
    [
      "an image on both sides at the one tile limit",
      { mediaType: "image/png", width: 384, height: 384 },
      258,
    ],
    [
      "a small, narrow image",
      { mediaType: "image/jpeg", width: 100, height: 300 },
      258,
    ],
    [
      "an image just over the one tile limit",
      { mediaType: "image/webp", width: 385, height: 385 },
      1032,
    ],
    [
      "the provider's own 960 by 540 example",
      { mediaType: "image/png", width: 960, height: 540 },
      1548,
    ],
    [
      "a square image",
      { mediaType: "image/png", width: 1000, height: 1000 },
      1032,
    ],
    [
      "a photo, where the shorter side sets the crop unit",
      { mediaType: "image/jpeg", width: 4032, height: 3024 },
      1032,
    ],
    [
      "a wide image",
      { mediaType: "image/png", width: 1920, height: 480 },
      3096,
    ],
    [
      "a pdf of three pages, whatever its size",
      { mediaType: "application/pdf", pages: 3, bytes: 9_000_000 },
      774,
    ],
    ["a pdf of unknown size", { mediaType: "application/pdf" }, 258],
    [
      "a pdf known by its size, at 50,000 bytes a page",
      { mediaType: "application/pdf", bytes: 120_000 },
      774,
    ],
    [
      "a pdf smaller than one page",
      { mediaType: "application/pdf", bytes: 100 },
      258,
    ],
    [
      "a pdf larger than the provider's page limit",
      { mediaType: "application/pdf", bytes: 100_000_000 },
      258_000,
    ],
    [
      "a text file, at about four bytes a token",
      { mediaType: "text/plain", bytes: 4000 },
      1000,
    ],
    ["a text file of a few bytes", { mediaType: "text/plain", bytes: 5 }, 2],
    ["a text file of unknown size", { mediaType: "text/plain" }, 258],
  ] as const)("counts %s", (_name, file, expected) => {
    expect(countFileTokens(file)).toBe(expected);
  });

  it("keeps a strip one pixel wide finite", () => {
    expect(
      Number.isFinite(
        countFileTokens({ mediaType: "image/png", width: 1, height: 2000 })
      )
    ).toBe(true);
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
