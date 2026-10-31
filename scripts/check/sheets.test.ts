import { describe, expect, it } from "@effect/vitest";
import { inspectStylesheet } from "#scripts/check/sheets";

describe("inspectStylesheet", () => {
  it.each([
    'html:has([data-open]) { color: red; }',
    'a {} body.dark:has(dialog) main { color: red; }',
    ':root:not(.light):has(dialog) { color: red; }',
  ])("rejects %s", (rule) => {
    expect(inspectStylesheet("a.css", rule)).toHaveLength(1);
  });

  it("allows a rule whose :has() answers for its own element", () => {
    expect(
      inspectStylesheet(
        "a.css",
        `:root:not([data-kept-plan])
  [data-slot="sidebar-footer"]:not(:has(li)) { display: none; }
.card:has(img) { padding: 0; }`
      )
    ).toEqual([]);
  });
});
