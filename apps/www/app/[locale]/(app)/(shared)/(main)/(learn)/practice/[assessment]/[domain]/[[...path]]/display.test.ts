// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readPracticeSetDisplay } from "./display";

describe("readPracticeSetDisplay", () => {
  it("reads authored localized display copy for a projected set route", () => {
    expect(
      readPracticeSetDisplay({
        locale: "en",
        publicPath: "practice/snbt/quantitative-knowledge/tryout-2026/set-1",
      })
    ).toMatchObject({
      groupTitle: "Try Out 2026",
      setTitle: "Set 1",
    });
  });

  it("fails closed when authored display metadata is missing", () => {
    expect(() =>
      readPracticeSetDisplay({
        locale: "en",
        publicPath:
          "practice/snbt/quantitative-knowledge/tryout-2026/missing-set",
      })
    ).toThrow();
  });
});
