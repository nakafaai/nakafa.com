import { describe, expect, it } from "vitest";
import {
  getDistanceFromBottom,
  isAtTranscriptBottom,
  isNearReadStateBottom,
} from "@/components/school/classes/forum/conversation/utils/transcript-scroll";

function createContainer(scrollTop = 200) {
  const container = document.createElement("div");
  let currentScrollTop = scrollTop;

  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    value: 1200,
  });
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
  });
  Object.defineProperty(container, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ bottom: 500, top: 100 }),
  });

  return container;
}

describe("conversation/utils/transcript-scroll", () => {
  it("measures bottom distance and near-bottom state", () => {
    const container = createContainer(798);

    expect(isAtTranscriptBottom(container)).toBe(true);
    expect(getDistanceFromBottom(container)).toBe(2);
    expect(isNearReadStateBottom(container)).toBe(true);
    expect(isNearReadStateBottom(undefined)).toBe(false);
  });

  it("returns false when the transcript is not close enough to bottom", () => {
    const container = createContainer(600);

    expect(isAtTranscriptBottom(container)).toBe(false);
    expect(getDistanceFromBottom(container)).toBe(200);
    expect(isNearReadStateBottom(container)).toBe(false);
  });
});
