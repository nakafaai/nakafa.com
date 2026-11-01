import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  PLACEMENT_PREPAINT_SCRIPT,
  paintPlacement,
} from "@/lib/content/material/prepaint";

/** The style that shows a path, as this document holds it. */
const paintStyle = () => document.querySelector("#placement-paint");

/** Runs the inline script against a fake address, on this document. */
function runPrepaint(search: string | (() => string)) {
  const fakeWindow = {
    location: {
      get search() {
        return typeof search === "string" ? search : search();
      },
    },
  };
  new Function("window", PLACEMENT_PREPAINT_SCRIPT)(fakeWindow);
}

afterEach(() => {
  paintPlacement(null);
});

describe("PLACEMENT_PREPAINT_SCRIPT", () => {
  it("shows the path of a curriculum hint, and hides the lesson's own", () => {
    for (const search of [
      "?ctx=merdeka~class-11-mathematics-functions",
      "?ctx=merdeka%7Eclass-11-mathematics-functions&ref=a",
    ]) {
      runPrepaint(search);
      expect(paintStyle()?.textContent, search).toContain(
        "merdeka\\~class-11-mathematics-functions"
      );
      expect(paintStyle()?.textContent, search).toContain(
        '[data-placement-path=""]{display:none!important}'
      );
      paintPlacement(null);
    }
  });

  it("leaves an address without a well-formed hint alone", () => {
    for (const search of [
      "",
      "?ctx=",
      "?ctx=merdeka",
      "?ctx=a~b~c",
      "?ctx=~b",
    ]) {
      runPrepaint(search);
      expect(paintStyle(), search).toBeNull();
    }
  });

  it("never stops the page when the address cannot be read", () => {
    runPrepaint(() => {
      throw new Error("blocked");
    });
    expect(paintStyle()).toBeNull();
  });
});

describe("paintPlacement", () => {
  it("shows one path at a time, and the lesson's own with no hint", () => {
    paintPlacement("merdeka~class-10");
    paintPlacement("merdeka~class-11");

    expect(document.querySelectorAll("#placement-paint")).toHaveLength(1);
    expect(paintStyle()?.textContent).toContain("merdeka\\~class-11");

    paintPlacement(null);
    expect(paintStyle()).toBeNull();
  });
});
