import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  PLACEMENT_PENDING_ATTRIBUTE,
  PLACEMENT_PREPAINT_SCRIPT,
  settlePlacementPaint,
} from "@/lib/content/material/prepaint";

/** Runs the inline script against a fake address and returns the attribute it set, if any. */
function runPrepaint(search: string | (() => string)) {
  let marked: string | undefined;
  const fakeWindow = {
    location: {
      get search() {
        return typeof search === "string" ? search : search();
      },
    },
  };
  const fakeDocument = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        marked = `${name}=${value}`;
      },
    },
  };
  new Function("window", "document", PLACEMENT_PREPAINT_SCRIPT)(
    fakeWindow,
    fakeDocument
  );
  return marked;
}

afterEach(() => {
  document.documentElement.removeAttribute(PLACEMENT_PENDING_ATTRIBUTE);
});

describe("PLACEMENT_PREPAINT_SCRIPT", () => {
  it("marks the placement pending for an address with a curriculum hint", () => {
    for (const search of [
      "?ctx=merdeka~class-11-mathematics-functions",
      "?ctx=merdeka%7Eclass-11-mathematics-functions&ref=a",
    ]) {
      expect(runPrepaint(search), search).toBe("data-placement=pending");
    }
  });

  it("leaves an address without a well-formed hint unmarked", () => {
    for (const search of [
      "",
      "?ctx=",
      "?ctx=merdeka",
      "?ctx=a~b~c",
      "?ctx=~b",
    ]) {
      expect(runPrepaint(search), search).toBeUndefined();
    }
  });

  it("never stops the page when the address cannot be read", () => {
    expect(
      runPrepaint(() => {
        throw new Error("blocked");
      })
    ).toBeUndefined();
  });
});

describe("settlePlacementPaint", () => {
  it("shows the breadcrumb path again", () => {
    document.documentElement.setAttribute(
      PLACEMENT_PENDING_ATTRIBUTE,
      "pending"
    );
    settlePlacementPaint();
    expect(
      document.documentElement.hasAttribute(PLACEMENT_PENDING_ATTRIBUTE)
    ).toBe(false);
  });
});
