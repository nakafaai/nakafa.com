import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { createPaperHold } from "@/components/player/hold";

describe("createPaperHold", () => {
  it("waits for the first texts of a paper alone, so a long paper never waits for its last page", () => {
    const hold = createPaperHold(
      Arr.makeBy(30, (index) => `text-${index}`),
      true
    );

    expect(hold.getState().waiting).toHaveLength(8);
    expect(hold.getState().waiting[0]).toBe("text-0");
  });

  it("ends the wait once every text it holds can draw, and a shared text counts once", () => {
    const hold = createPaperHold(["reading", "first", "reading"], true);

    hold.getState().settle("reading");
    expect(hold.getState().waiting).toEqual(["first"]);

    hold.getState().settle("first");
    expect(hold.getState().waiting).toEqual([]);
  });

  it("reads a few texts at a time, and each text that can draw gives its place to the next", () => {
    const hold = createPaperHold(
      Arr.makeBy(10, (index) => `text-${index}`),
      true
    );

    expect(hold.getState().reading).toHaveLength(8);
    expect(hold.getState().queued).toEqual(["text-8", "text-9"]);

    hold.getState().settle("text-0");

    expect(hold.getState().reading).toContain("text-8");
    expect(hold.getState().queued).toEqual(["text-9"]);
  });

  it("reads a text the reader went to next, and the texts after it before the ones it passed", () => {
    const hold = createPaperHold(
      Arr.makeBy(14, (index) => `text-${index}`),
      true
    );

    hold.getState().hurry("text-11");

    expect(hold.getState().reading).toContain("text-11");
    expect(hold.getState().queued).toEqual([
      "text-12",
      "text-13",
      "text-8",
      "text-9",
      "text-10",
    ]);
  });

  it("leaves the turns as they are for a text that is reading or has read", () => {
    const hold = createPaperHold(
      Arr.makeBy(9, (index) => `text-${index}`),
      true
    );

    hold.getState().hurry("text-2");
    expect(hold.getState().queued).toEqual(["text-8"]);

    hold.getState().settle("text-2");
    hold.getState().settle("text-2");

    expect(hold.getState().reading).toHaveLength(8);
    expect(hold.getState().queued).toEqual([]);
  });

  it("waits for the code that draws the texts, once it is told a paper needs it", () => {
    const hold = createPaperHold([], false);
    expect(hold.getState().drawable).toBe(false);

    hold.getState().prime();

    expect(hold.getState().drawable).toBe(true);
  });

  it("lets a paper go when a text never answers, or its code never loads", () => {
    const hold = createPaperHold(["first", "second"], false);

    hold.getState().release();

    expect(hold.getState().waiting).toEqual([]);
    expect(hold.getState().drawable).toBe(true);
  });
});
