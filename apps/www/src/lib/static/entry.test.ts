import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { SCHOOL_ENTRY_ID, schoolEntryPath } from "@/lib/routing/shell";
import { composeSchoolEntry, readSchoolEntry } from "@/lib/static/entry";

/** A prerendered page, whose sign-in holds nested elements and has markup on both sides. */
const PAGE = `<!doctype html><html lang="en"><body><div class="provider"><div class="fixed" id="${SCHOOL_ENTRY_ID}"><main><div><h1>Sign in</h1></div></main></div></div><div hidden></div></body></html>`;

/** The sign-in of that page. */
const ENTRY = `<div class="fixed" id="${SCHOOL_ENTRY_ID}"><main><div><h1>Sign in</h1></div></main></div>`;

const SHELL =
  '<!doctype html><html dir="ltr" lang="en"><head></head><body><div></div><script src="/a.js"></script></body></html>';

describe("lib/static/entry", () => {
  it("names one locale's shell", () => {
    expect(schoolEntryPath("id")).toBe("/_entry/school/id");
  });

  it("reads the whole sign-in, with what it holds and nothing around it", () => {
    expect(readSchoolEntry(PAGE)).toStrictEqual(Option.some(ENTRY));
  });

  it("finds no sign-in in a page that drew none", () => {
    expect(readSchoolEntry("<html><body></body></html>")).toStrictEqual(
      Option.none()
    );
  });

  it("puts the sign-in after everything that hydrates, in the page's language", () => {
    expect(composeSchoolEntry(SHELL, ENTRY, "de")).toBe(
      `<!doctype html><html dir="ltr" lang="de"><head></head><body><div></div><script src="/a.js"></script>${ENTRY}</body></html>`
    );
  });
});
