// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { entryModule, LIBRARIES, shimName } from "#catalog/entry";

describe("entryModule", () => {
  it("exports every module, binds every card, and hands the cards to the showcase", () => {
    const text = entryModule(
      ["badge", "button-group"],
      ["badge", "group"],
      "/ds"
    );
    expect(text).toContain('export * from "/ds/components/ui/badge";');
    expect(text).toContain('export * from "/ds/components/ui/button-group";');
    expect(text).toContain('import * as card1 from "/ds/catalog/cards/group";');
    expect(text).toContain("export const showcase = catalog([card0, card1]);");
    expect(text).toContain('export { Root } from "/ds/catalog/page";');
  });
});

describe("shimName", () => {
  it("names one file per module, without slashes", () => {
    expect(shimName("react-dom/client")).toBe("global-react-dom-client.cjs");
  });
});

describe("LIBRARIES", () => {
  it("puts React with its JSX runtime and React DOM with its client on the page", () => {
    expect(LIBRARIES.react).toContain(
      "Object.assign(window, { React, ReactJSX });"
    );
    expect(LIBRARIES["react-dom"]).toContain("ReactDOM: { ...DOM, ...Client }");
  });
});
