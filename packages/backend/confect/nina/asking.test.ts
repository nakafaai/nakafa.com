import { describe, expect, it } from "@effect/vitest";
import { newestAskings, questionKey } from "@repo/backend/confect/nina/asking";

describe("Nina newest askings", () => {
  const ask = (order: number, retryOf?: number) =>
    retryOf === undefined ? { order } : { order, retryOf };

  it("keeps the newest asking of each question, whichever asking a retry named", () => {
    // Orders 1 and 3 ask the question of order 0 again, and order 2 asks another.
    expect(newestAskings([ask(0), ask(1, 0), ask(2), ask(3, 0)], [])).toEqual([
      ask(2),
      ask(3, 0),
    ]);
  });

  it("lets a later turn take its question from the turns before it", () => {
    expect(newestAskings([ask(0), ask(1)], [ask(2, 0)])).toEqual([ask(1)]);
  });

  it("names a question by the order of the turn that first asked it", () => {
    expect(questionKey({ order: 4, retryOf: 1 })).toBe(1);
    expect(questionKey({ order: 4 })).toBe(4);
  });
});
