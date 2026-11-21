import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  opensSetPaper,
  SET_PAPER_ATTRIBUTE,
  setPaperScript,
  TryoutAttemptSearch,
} from "@/components/tryout/route/search";

describe("TryoutAttemptSearch", () => {
  it("keeps a single or repeated attempt value as text for the attempt readers", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({
        attemptId: ["a", "b"],
        view: "list",
      })
    ).toEqual({ attemptId: ["a", "b"], view: "list" });
  });

  it("reads a value that TanStack parsed as JSON back to its text, so a non-view stays invalid", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({
        attemptId: 12_345,
        view: 1,
      })
    ).toEqual({ attemptId: "12345", view: "1" });
    expect(Schema.decodeSync(TryoutAttemptSearch)({ view: false })).toEqual({
      view: "false",
    });
  });

  it("reads each repeated value of any JSON scalar kind as text", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({ attemptId: [1, "b"] })
    ).toEqual({ attemptId: ["1", "b"] });
  });

  it("reads a value of another shape as empty, which the readers refuse", () => {
    expect(
      Schema.decodeUnknownSync(TryoutAttemptSearch)({
        attemptId: { id: "a" },
        view: [{ view: "list" }],
      })
    ).toEqual({ attemptId: "", view: "" });
  });

  it("keeps the question as the number the router parsed, so the address writes it back unquoted", () => {
    expect(Schema.decodeSync(TryoutAttemptSearch)({ question: 12 })).toEqual({
      question: 12,
    });
    expect(Schema.encodeSync(TryoutAttemptSearch)({ question: 12 })).toEqual({
      question: 12,
    });
  });

  it("drops a question that names none, so the player opens the first", () => {
    expect(
      Schema.decodeUnknownSync(TryoutAttemptSearch)({ question: "abc" })
    ).toEqual({});
    expect(Schema.decodeSync(TryoutAttemptSearch)({ question: 0 })).toEqual({});
  });

  it("encodes the text it decoded back to the same text", () => {
    expect(
      Schema.encodeSync(TryoutAttemptSearch)({ attemptId: "abc", view: "list" })
    ).toEqual({ attemptId: "abc", view: "list" });
  });
});

describe("opensSetPaper", () => {
  it("opens the practice of any set on the whole page", () => {
    expect(opensSetPaper({ mode: "practice" }, false)).toBe(true);
    expect(opensSetPaper({ mode: "practice" }, true)).toBe(true);
  });

  it("opens the attempt a set entered by its one section names, and its pane otherwise", () => {
    expect(opensSetPaper({ attemptId: "a" }, true)).toBe(true);
    expect(opensSetPaper({}, true)).toBe(false);
    expect(opensSetPaper({ attemptId: "a" }, false)).toBe(false);
  });
});

/** Whether the prepaint script marks itself for an address, run as the browser runs it while it reads the markup. */
function marksPaper(entered: boolean, search: string) {
  const marks = new Set<string>();
  const script = { setAttribute: (name: string) => marks.add(name) };
  new Function("location", "document", setPaperScript(entered))(
    { search },
    { currentScript: script }
  );
  return marks.has(SET_PAPER_ATTRIBUTE);
}

describe("setPaperScript", () => {
  it("decides before the first paint as the page decides once hydrated", () => {
    const cases = [
      { entered: false, search: "", value: {} },
      { entered: false, search: "?mode=practice", value: { mode: "practice" } },
      { entered: true, search: "?mode=practice", value: { mode: "practice" } },
      { entered: false, search: "?attemptId=a", value: { attemptId: "a" } },
      { entered: true, search: "?attemptId=a", value: { attemptId: "a" } },
      {
        entered: true,
        search: "?attemptId=a&question=3",
        value: { attemptId: "a" },
      },
      { entered: true, search: "?view=list", value: {} },
      { entered: true, search: "?mode=review", value: { mode: "review" } },
    ] as const;
    for (const { entered, search, value } of cases) {
      expect(marksPaper(entered, search)).toBe(opensSetPaper(value, entered));
    }
  });
});
