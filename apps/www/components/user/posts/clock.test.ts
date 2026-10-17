import { describe, expect, it } from "@effect/vitest";
import { createPostsClock } from "@/components/user/posts/clock";

describe("posts clock", () => {
  it("starts from the moment the server read the page, so the server and the browser agree", () => {
    expect(createPostsClock(1000).getState().now).toBe(1000);
  });

  it("moves to the moment of each tick, so the ages keep up with the time", () => {
    const clock = createPostsClock(1000);
    clock.getState().setNow(61_000);
    expect(clock.getState().now).toBe(61_000);
  });
});
