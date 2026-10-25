import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { nextAnswer, shownAnswer } from "@/components/ai/chat/kept";

const before = QueryResult.succeed("the chat of the learner before");
const after = QueryResult.succeed("the chat of the learner now");
const reading = QueryResult.load<string>(false);
const skipped = QueryResult.load<string>(true);

describe("chat/kept", () => {
  it("keeps the server's newest answer", () => {
    expect(nextAnswer(before, after)).toBe(after);
    expect(nextAnswer(skipped, before)).toBe(before);
  });

  it("keeps the last answer while a read of the same chat starts again", () => {
    expect(nextAnswer(before, reading)).toBe(before);
    expect(shownAnswer(before, reading)).toEqual({
      current: false,
      value: "the chat of the learner before",
    });
  });

  it("drops the last answer when a read is skipped, so the read after it shows nothing until the server answers", () => {
    const dropped = nextAnswer(before, skipped);

    expect(dropped).toBe(skipped);
    expect(shownAnswer(dropped, reading)).toEqual({
      current: false,
      value: undefined,
    });
    // Once dropped, the skipped read is kept as it is, so a render does not set it again.
    expect(nextAnswer(dropped, QueryResult.load<string>(true))).toBe(dropped);
  });

  it("shows the server's answer as current and nothing while the first read loads", () => {
    expect(shownAnswer(before, after)).toEqual({
      current: true,
      value: "the chat of the learner now",
    });
    expect(shownAnswer(reading, reading)).toEqual({
      current: false,
      value: undefined,
    });
    expect(shownAnswer(before, skipped)).toEqual({
      current: false,
      value: undefined,
    });
  });
});
