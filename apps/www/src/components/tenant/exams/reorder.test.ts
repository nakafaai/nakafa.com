import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  dropIndex,
  type PageBox,
  placeOf,
  siblingShift,
  steppedIndex,
} from "@/components/tenant/exams/reorder";

/** Three pages of 100 pixels with a gap of 20 between them, the first at the top. */
const pages: readonly PageBox[] = [
  { height: 100, top: 0 },
  { height: 100, top: 120 },
  { height: 100, top: 240 },
];

describe("dropIndex", () => {
  it("keeps a page in its place while it moves less than half a page", () => {
    expect(dropIndex(pages, 1, 0)).toBe(1);
    expect(dropIndex(pages, 1, 49)).toBe(1);
    expect(dropIndex(pages, 1, -49)).toBe(1);
  });

  it("takes the place below the pages whose middle the page has passed", () => {
    expect(dropIndex(pages, 0, 130)).toBe(1);
    expect(dropIndex(pages, 0, 300)).toBe(2);
  });

  it("takes the place above the pages whose middle the page has passed", () => {
    expect(dropIndex(pages, 2, -130)).toBe(1);
    expect(dropIndex(pages, 2, -300)).toBe(0);
  });

  it("keeps the page where it is when the page is not on the canvas", () => {
    expect(dropIndex(pages, 5, 300)).toBe(5);
  });
});

describe("siblingShift", () => {
  it("moves the pages between a page dragged down up by the step", () => {
    expect(siblingShift(0, 0, 2, 120)).toBe(0);
    expect(siblingShift(1, 0, 2, 120)).toBe(-120);
    expect(siblingShift(2, 0, 2, 120)).toBe(-120);
    expect(siblingShift(3, 0, 2, 120)).toBe(0);
  });

  it("moves the pages between a page dragged up down by the step", () => {
    expect(siblingShift(0, 2, 0, 120)).toBe(120);
    expect(siblingShift(1, 2, 0, 120)).toBe(120);
    expect(siblingShift(2, 2, 0, 120)).toBe(0);
  });

  it("moves no page when the page takes its own place", () => {
    expect(siblingShift(0, 1, 1, 120)).toBe(0);
    expect(siblingShift(1, 1, 1, 120)).toBe(0);
  });
});

describe("placeOf", () => {
  const order = ["question-a", "question-b", "question-c"];

  it("names the index and the ID of the question a grip names", () => {
    expect(placeOf(order, "question-b")).toEqual(
      Option.some({ index: 1, questionId: "question-b" })
    );
  });

  it("names no question for a grip that names none of the order, or no question at all", () => {
    expect(placeOf(order, "question-z")).toEqual(Option.none());
    expect(placeOf(order, undefined)).toEqual(Option.none());
  });
});

describe("steppedIndex", () => {
  it("steps a question up or down by one place", () => {
    expect(steppedIndex(1, -1, 3)).toEqual(Option.some(0));
    expect(steppedIndex(1, 1, 3)).toEqual(Option.some(2));
  });

  it("leaves the order where the step would pass its first or last question", () => {
    expect(steppedIndex(0, -1, 3)).toEqual(Option.none());
    expect(steppedIndex(2, 1, 3)).toEqual(Option.none());
  });
});
