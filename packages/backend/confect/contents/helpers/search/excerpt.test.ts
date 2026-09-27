import { expect, it } from "@effect/vitest";
import { buildContentSearchExcerpt } from "@repo/backend/confect/contents/helpers/search/excerpt";

it("selects complete terms and the last prefix instead of unrelated substrings", () => {
  const text = `Nonlinear models. ${"Background context. ".repeat(25)} Linear functions provide the relevant example. ${"Further reading. ".repeat(25)}`;
  const excerpt = buildContentSearchExcerpt({ description: "Overview", text }, [
    "linear func",
  ]);
  expect(excerpt).toContain("Linear functions provide the relevant example.");
  expect(excerpt).not.toContain("Nonlinear");
  expect(excerpt.startsWith("...")).toBe(true);
  expect(excerpt.endsWith("...")).toBe(true);
  expect(
    buildContentSearchExcerpt(
      { description: "Overview", text: "Linearity without functions" },
      ["linear func"]
    )
  ).toBe("Linearity without functions");
  expect(
    buildContentSearchExcerpt(
      { description: "Overview", text: "Linearity without a match" },
      ["linear func"]
    )
  ).toBe("Overview");
});

it("finds a later query variant and preserves multilingual case-conversion offsets", () => {
  const prefix = "İ ".repeat(120);
  const text = `${prefix}Ausführliche Erklärung zur Äquivalenz. ${"Weiterlesen. ".repeat(30)}`;
  const excerpt = buildContentSearchExcerpt(
    { description: "Übersicht", text },
    ["missing", "ÄQUI"]
  );
  expect(excerpt).toContain("Ausführliche Erklärung zur Äquivalenz.");
  expect(excerpt).not.toContain("Übersicht");
});

it("normalizes short matches and chooses readable description or body fallbacks", () => {
  const document = {
    description: "\tShort\n description. ",
    text: "\tLinear\n equations. ",
  };
  expect(buildContentSearchExcerpt(document, ["linear", "linear"])).toBe(
    "Linear equations."
  );
  expect(buildContentSearchExcerpt(document, ["missing"])).toBe(
    "Short description."
  );
  expect(buildContentSearchExcerpt(document, ["!!!"])).toBe(
    "Short description."
  );
  expect(
    buildContentSearchExcerpt({ ...document, description: " \n" }, [])
  ).toBe("Linear equations.");
  expect(buildContentSearchExcerpt({ description: "", text: "" }, [])).toBe("");
  expect(
    buildContentSearchExcerpt({ description: "A".repeat(230), text: "" }, [])
  ).toBe(`${"A".repeat(220)}...`);
});

it("keeps beginning and ending context without unnecessary ellipses", () => {
  const beginning = buildContentSearchExcerpt(
    {
      description: "",
      text: `Linear equations. ${"Nearby explanation. ".repeat(30)}`,
    },
    ["linear"]
  );
  expect(beginning.startsWith("Linear equations.")).toBe(true);
  expect(beginning.endsWith("...")).toBe(true);
  const ending = buildContentSearchExcerpt(
    {
      description: "",
      text: `${"Earlier explanation. ".repeat(30)}Linear equations.`,
    },
    ["linear"]
  );
  expect(ending.startsWith("...")).toBe(true);
  expect(ending.endsWith("Linear equations.")).toBe(true);
});

it("bounds excerpts even when a long word has no nearby space", () => {
  const text = `${"x".repeat(300)} 線形${"式".repeat(300)}`;
  const excerpt = buildContentSearchExcerpt({ description: "", text }, [
    "線形",
  ]);
  expect(excerpt).toContain("線形");
  expect(excerpt.length).toBeLessThanOrEqual(226);
  const unbroken = buildContentSearchExcerpt(
    { description: "", text: `線形${"式".repeat(300)}` },
    ["線形"]
  );
  expect(unbroken).toBe(`線形${"式".repeat(218)}...`);
});
