import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  outlineIds,
  readingHeading,
  revealOffset,
} from "@/components/shared/outline/reading";

/** Three headings 600 px apart, the first `scroll` px above where it starts. */
const placesAt = (scroll: number) => [
  { id: "first", line: 176, top: 200 - scroll },
  { id: "second", line: 176, top: 800 - scroll },
  { id: "third", line: 176, top: 1400 - scroll },
];

const reading = { atEnd: false, height: 900 };

describe("outlineIds", () => {
  it("takes each heading's id from its link, children after their parent", () => {
    expect(
      outlineIds([
        {
          children: [{ children: [], href: "#child", label: "Child" }],
          href: "#parent",
          label: "**Parent**",
        },
        { children: [], href: "#x^2", label: "x^2" },
      ])
    ).toEqual(["parent", "child", "x^2"]);
  });
});

describe("readingHeading", () => {
  it("reads no section above the first heading", () => {
    expect(readingHeading(placesAt(0), reading)).toEqual(Option.none());
  });

  it("reads a section from the moment its heading reaches the line, both ways", () => {
    expect(readingHeading(placesAt(24), reading)).toEqual(Option.some("first"));
    expect(readingHeading(placesAt(623), reading)).toEqual(
      Option.some("first")
    );
    expect(readingHeading(placesAt(624), reading)).toEqual(
      Option.some("second")
    );
    expect(readingHeading(placesAt(623), reading)).toEqual(
      Option.some("first")
    );
  });

  it("reads the last heading on screen at the end of the page", () => {
    const end = { atEnd: true, height: 900 };

    expect(readingHeading(placesAt(400), end)).toEqual(Option.some("second"));
    expect(readingHeading(placesAt(600), end)).toEqual(Option.some("third"));
  });

  it("reads nothing on a page without headings", () => {
    expect(readingHeading([], reading)).toEqual(Option.none());
  });
});

describe("revealOffset", () => {
  const scroller = { bottom: 500, top: 100 };

  it("leaves an entry inside the scroller where it is", () => {
    expect(revealOffset({ bottom: 300, top: 260 }, scroller)).toBe(0);
  });

  it("moves up to an entry above the scroller", () => {
    expect(revealOffset({ bottom: 120, top: 80 }, scroller)).toBe(-20);
  });

  it("moves down to an entry below the scroller", () => {
    expect(revealOffset({ bottom: 540, top: 500 }, scroller)).toBe(40);
  });

  it("brings the top of an entry taller than the scroller into view first", () => {
    expect(revealOffset({ bottom: 900, top: 300 }, scroller)).toBe(200);
  });
});
