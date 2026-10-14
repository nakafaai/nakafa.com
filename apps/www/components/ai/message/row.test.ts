import { describe, expect, it } from "@effect/vitest";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { sameRow } from "@/components/ai/message/row";

/** One step of Nina's answer to the first turn, as the feed holds it. */
function answer(text: string): NinaMessage {
  return {
    _creationTime: 1,
    id: "reply-1",
    key: "thread-1-1-0",
    order: 1,
    parts: [{ state: "done", text, type: "text" }],
    role: "assistant",
    status: "success",
    stepOrder: 0,
    text,
  };
}

const settled = { last: false, loadMore: undefined, message: answer("Hello") };

describe("transcript row", () => {
  it("keeps a row whose message says the same words, even when the feed built a new object", () => {
    expect(sameRow(settled, { ...settled, message: answer("Hello") })).toBe(
      true
    );
  });

  it("renders a row whose words changed", () => {
    expect(
      sameRow(settled, { ...settled, message: answer("Hello, again") })
    ).toBe(false);
  });

  it("renders a row that became the newest", () => {
    expect(sameRow(settled, { ...settled, last: true })).toBe(false);
  });

  it("renders a row whose older messages can now load", () => {
    expect(sameRow(settled, { ...settled, loadMore: () => undefined })).toBe(
      false
    );
  });
});
