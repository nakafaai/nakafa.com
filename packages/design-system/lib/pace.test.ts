import { afterEach, describe, expect, it } from "@effect/vitest";
import { createFramePace } from "@repo/design-system/lib/pace";

/** Sets the moment at which the pace finds the frame painted. */
const paintedAt = (now: number) =>
  vi.spyOn(performance, "now").mockReturnValue(now);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createFramePace", () => {
  it("draws every frame while a frame is cheap", async () => {
    const pace = createFramePace();

    expect(pace.isDue(0)).toBe(true);
    paintedAt(2);
    pace.rest(0);
    await vi.waitFor(() => expect(pace.isDue(16)).toBe(true));
  });

  it("holds the loop until its frame has painted, then rests seven times what the frame took", async () => {
    const pace = createFramePace();

    paintedAt(120);
    pace.rest(100);
    expect(pace.isDue(10_000)).toBe(false);
    await vi.waitFor(() => expect(pace.isDue(260)).toBe(true));
    expect(pace.isDue(259)).toBe(false);
  });
});
