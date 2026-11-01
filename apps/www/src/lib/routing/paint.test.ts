import { describe, expect, it } from "@effect/vitest";
import { paintFirst } from "@/lib/routing/paint";

describe("paintFirst", () => {
  it("waits for a frame before the move goes on", async () => {
    const frame = vi.fn<typeof requestAnimationFrame>(() => 1);
    vi.stubGlobal("requestAnimationFrame", frame);
    let moved = false;
    const move = paintFirst()?.then(() => {
      moved = true;
    });

    await Promise.resolve();
    expect(moved).toBe(false);

    frame.mock.calls[0]?.[0](0);
    await move;
    expect(moved).toBe(true);
    vi.unstubAllGlobals();
  });

  it("goes on by itself when the page draws no frame", async () => {
    const cancelled = vi.fn<typeof cancelAnimationFrame>();
    vi.stubGlobal("requestAnimationFrame", () => 7);
    vi.stubGlobal("cancelAnimationFrame", cancelled);

    await paintFirst();

    expect(cancelled).toHaveBeenCalledWith(7);
    vi.unstubAllGlobals();
  });

  it("waits for nothing on the server", () => {
    vi.stubGlobal("document", undefined);

    expect(paintFirst()).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
